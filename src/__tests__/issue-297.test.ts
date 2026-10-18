import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z3 from "zod";
import "zod-openapi/extend";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

/** The components of a document where `schema` is a request and a response. */
const componentsFor = async (
  schema: z.ZodType | z3.ZodType,
  composeOutputComponents = true,
) => {
  const app = new Hono().post(
    "/pets",
    describeRoute({
      responses: {
        200: {
          content: { "application/json": { schema: resolver(schema) } },
          description: "OK",
        },
      },
    }),
    validator("json", schema),
    (c) => c.json({}),
  );
  return (
    (await generateSpecs(app, { composeOutputComponents })).components
      ?.schemas ?? {}
  );
};

const Item = z
  .strictObject({ quantity: z.number().default(1), sku: z.string() })
  .meta({ ref: "Item" });

describe("an output form", () => {
  it("is written over its input form, without repeating it", async () => {
    const Order = z
      .strictObject({
        channel: z.enum(["kiosk", "store", "web"]),
        items: z.array(Item),
        status: z.enum(["draft", "placed", "shipped"]).default("draft"),
      })
      .meta({ ref: "Order" });

    const schemas = await componentsFor(Order);

    expect(schemas.OrderOutput).toEqual({
      allOf: [
        { $ref: "#/components/schemas/Order" },
        {
          properties: {
            items: {
              items: { $ref: "#/components/schemas/ItemOutput" },
              type: "array",
            },
          },
          required: ["status"],
        },
      ],
    });
    expect(schemas.ItemOutput).toEqual({
      allOf: [
        { $ref: "#/components/schemas/Item" },
        { required: ["quantity"] },
      ],
    });
  });

  it("lists every property when it closes the object", async () => {
    const Pet = z
      .object({ name: z.string(), tag: z.string().default("none") })
      .meta({ ref: "Pet" });

    const schemas = await componentsFor(Pet);

    expect(schemas.PetOutput).toEqual({
      allOf: [
        { $ref: "#/components/schemas/Pet" },
        {
          additionalProperties: false,
          properties: { name: {}, tag: {} },
          required: ["tag"],
        },
      ],
    });
  });

  it("stays whole unless `composeOutputComponents` is set", async () => {
    const schemas = await componentsFor(Item, false);

    expect(schemas.ItemOutput).toMatchObject({ required: ["quantity", "sku"] });
  });

  it("stays whole when it's a union of output forms", async () => {
    const Shape = z
      .discriminatedUnion("kind", [
        z
          .strictObject({
            kind: z.literal("circle"),
            radius: z.number().default(1),
          })
          .meta({ ref: "Circle" }),
        z
          .strictObject({ kind: z.literal("square"), side: z.number() })
          .meta({ ref: "Square" }),
      ])
      .meta({ ref: "Shape" });

    const schemas = await componentsFor(Shape);

    expect(schemas.ShapeOutput).toBeDefined();
    expect(schemas.ShapeOutput).not.toHaveProperty("allOf");
    expect(schemas.CircleOutput).toHaveProperty("allOf");
  });

  it("stays whole when a property changes type", async () => {
    const Reading = z
      .strictObject({
        unit: z.enum(["c", "f"]).default("c"),
        value: z.string().transform(Number).pipe(z.number()),
      })
      .meta({ ref: "Reading" });

    const schemas = await componentsFor(Reading);

    expect(schemas.ReadingOutput).toBeDefined();
    expect(schemas.ReadingOutput).not.toHaveProperty("allOf");
  });
});

// An `Owner` whose output form sends `id` as a number, though a request sends
// it as a string, and a `Pet` that refers to an owner.
const Owner3 = z3
  .object({ id: z3.string().transform(Number).pipe(z3.number()) })
  .strict()
  .openapi({ ref: "Owner" });
const Owner4 = z
  .strictObject({ id: z.string().transform(Number).pipe(z.number()) })
  .meta({ ref: "Owner" });
const pet3 = (owner: z3.ZodType) =>
  z3
    .object({ owner, tag: z3.string().default("none") })
    .strict()
    .openapi({ ref: "Pet" });
const pet4 = (owner: z.ZodType) =>
  z
    .strictObject({ owner, tag: z.string().default("none") })
    .meta({ ref: "Pet" });

describe("an output form that refers to one changed by a transform", () => {
  it.each([
    { name: "zod 3", schema: pet3(Owner3) },
    { name: "zod 4", schema: pet4(Owner4) },
  ])("stays whole with $name", async ({ schema }) => {
    const schemas = await componentsFor(schema);

    expect(schemas.PetOutput).not.toHaveProperty("allOf");
    expect(schemas.PetOutput).toMatchObject({
      properties: { owner: { $ref: "#/components/schemas/OwnerOutput" } },
      required: ["owner", "tag"],
    });
  });

  it.each([
    { name: "zod 3", schema: pet3(Owner3.nullable()) },
    { name: "zod 4", schema: pet4(Owner4.nullable()) },
  ])(
    "stays whole when a union refers to it, with $name",
    async ({ schema }) => {
      const schemas = await componentsFor(schema);

      expect(schemas.PetOutput).not.toHaveProperty("allOf");
    },
  );

  it("stays whole when it's further down", async () => {
    const Shelter = z
      .strictObject({
        name: z.string().default("unnamed"),
        pets: z.array(pet4(Owner4)),
      })
      .meta({ ref: "Shelter" });

    const schemas = await componentsFor(Shelter);

    expect(schemas.ShelterOutput).not.toHaveProperty("allOf");
    expect(schemas.ShelterOutput).toMatchObject({
      properties: {
        pets: { items: { $ref: "#/components/schemas/PetOutput" } },
      },
    });
    expect(schemas.PetOutput).not.toHaveProperty("allOf");
  });

  it("stays whole when it refers to itself", async () => {
    const Category = z
      .strictObject({
        get children() {
          return z.array(Category);
        },
        id: z.string().transform(Number).pipe(z.number()),
      })
      .meta({ ref: "Category" });
    const Catalog = z
      .strictObject({
        root: Category,
        title: z.string().default("untitled"),
      })
      .meta({ ref: "Catalog" });

    const schemas = await componentsFor(Catalog);

    expect(schemas.CatalogOutput).not.toHaveProperty("allOf");
  });
});

describe("an output form that refers to one that only adds to its input form", () => {
  it("stays whole when it refers to it outside its properties", async () => {
    const Inventory = z
      .object({ updatedAt: z.string().default("never") })
      .catchall(Item)
      .meta({ ref: "Inventory" });

    const schemas = await componentsFor(Inventory);

    expect(schemas.InventoryOutput).not.toHaveProperty("allOf");
    expect(schemas.InventoryOutput).toMatchObject({
      additionalProperties: { $ref: "#/components/schemas/ItemOutput" },
    });
  });

  it("is written over its input form when that one is further down", async () => {
    const Shelter = z
      .strictObject({
        name: z.string().default("unnamed"),
        pets: z.array(
          pet4(
            z
              .strictObject({
                name: z.string(),
                verified: z.boolean().default(false),
              })
              .meta({ ref: "Owner" }),
          ),
        ),
      })
      .meta({ ref: "Shelter" });

    const schemas = await componentsFor(Shelter);

    expect(schemas.ShelterOutput).toEqual({
      allOf: [
        { $ref: "#/components/schemas/Shelter" },
        {
          properties: {
            pets: {
              items: { $ref: "#/components/schemas/PetOutput" },
              type: "array",
            },
          },
          required: ["name"],
        },
      ],
    });
    expect(schemas.PetOutput).toHaveProperty("allOf");
  });

  it("is written over its input form when it refers to itself", async () => {
    const Category = z
      .strictObject({
        get children() {
          return z.array(Category);
        },
        name: z.string().default("unnamed"),
      })
      .meta({ ref: "Category" });

    const schemas = await componentsFor(Category);

    expect(schemas.CategoryOutput).toEqual({
      allOf: [
        { $ref: "#/components/schemas/Category" },
        {
          properties: {
            children: {
              items: { $ref: "#/components/schemas/CategoryOutput" },
              type: "array",
            },
          },
          required: ["name"],
        },
      ],
    });
  });
});
