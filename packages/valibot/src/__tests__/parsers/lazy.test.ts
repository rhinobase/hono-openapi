import type { Schema } from "../types";
import { createSchema } from "../../index";
import * as v from "valibot";

describe("createLazySchema", () => {
  it("throws an error when a lazy schema has no ref", () => {
    const lazy: any = v.lazy(() => lazy.array());

    expect(() =>
      createSchemaObject(lazy, createOutputState(), ["response"])
    ).toThrow(
      `The schema at response > lazy schema > array items needs to be registered because it's circularly referenced`
    );
  });

  it("throws errors when cycles without refs are detected", () => {
    const cycle1: any = v.lazy(() => v.array(v.object({ foo: cycle1 })));
    expect(() =>
      createSchemaObject(cycle1, createOutputState(), ["response"])
    ).toThrow(
      `The schema at response > lazy schema > array items > property: foo needs to be registered because it's circularly referenced`
    );
    const cycle2: any = v.lazy(() => v.union([v.number(), v.array(cycle2)]));
    expect(() =>
      createSchemaObject(cycle2, createOutputState(), ["response"])
    ).toThrow(
      `The schema at response > lazy schema > union option 1 > array items needs to be registered because it's circularly referenced`
    );
    const cycle3: any = v.lazy(() =>
      v.record(v.string(), v.tuple([cycle3.optional()]))
    );
    expect(() =>
      createSchemaObject(cycle3, createOutputState(), ["response"])
    ).toThrow(
      `The schema at response > lazy schema > record value > tuple item 0 > optional needs to be registered because it's circularly referenced`
    );
  });

  it("creates an lazy schema when the schema contains a ref", () => {
    const lazy: any = v.pipe(
      v.lazy(() => lazy.array()),
      v.metadata({ ref: "lazy" })
    );

    const state = createOutputState();
    state.components.schemas.set(lazy, {
      type: "in-progress",
      ref: "lazy",
    });

    const expected: Schema = {
      type: "array",
      items: { $ref: "#/components/schemas/lazy" },
    };

    const result = createLazySchema(lazy, state);
    expect(result).toEqual(expected);
  });

  it("supports registering the base schema", () => {
    const BasePost = v.object({
      id: v.string(),
      userId: v.string(),
    });

    type Post = v.InferInput<typeof BasePost> & {
      user?: User;
    };

    const BaseUser = v.object({
      id: v.string(),
    });

    type User = v.InferInput<typeof BaseUser> & {
      posts?: Post[];
    };

    const PostSchema: any = v.pipe(
      v.object({
        ...BasePost.entries,
        user: v.optional(v.lazy(() => UserSchema)),
      }),
      v.metadata({ ref: "post" })
    );

    const UserSchema = v.pipe(
      v.object({
        ...BaseUser.entries,
        posts: v.optional(v.array(v.lazy(() => PostSchema))),
      }),
      v.metadata({ ref: "user" })
    );

    const state = createOutputState();
    state.components.schemas.set(UserSchema, {
      type: "in-progress",
      ref: "user",
    });

    const expected: Schema = {
      type: "object",
      properties: {
        id: {
          type: "string",
        },
        posts: {
          type: "array",
          items: { $ref: "#/components/schemas/post" },
        },
      },
      required: ["id"],
    };

    const result = createSchema(UserSchema);

    expect(result).toStrictEqual(expected);
  });

  it("supports sibling properties that are circular references", () => {
    const expected: Schema = {
      type: "object",
      properties: {
        id: {
          type: "string",
        },
        posts: {
          type: "array",
          items: { $ref: "#/components/schemas/post" },
        },
        comments: {
          type: "array",
          items: { $ref: "#/components/schemas/post" },
        },
      },
      required: ["id"],
    };

    const BasePost = v.object({
      id: v.string(),
      userId: v.string(),
    });

    const BaseUser = v.object({
      id: v.string(),
    });

    const PostSchema: any = v.object({
      ...BasePost.entries,
      user: v.optional(v.lazy(() => UserSchema)),
    });

    const PostArray = v.array(v.lazy(() => PostSchema));

    const UserSchema = v.lazy(() =>
      v.object({
        ...BaseUser.entries,
        posts: v.optional(PostArray),
        comments: v.optional(PostArray),
      })
    );

    const result = createSchema(UserSchema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a lazy schema which contains an effect", () => {
    type Post = {
      id: string;
      userId: string;
      user: Post;
    };

    const UserIdSchema = v.string();

    const PostSchema: any = v.pipe(
      v.object({
        id: v.string(),
        userId: UserIdSchema,
        user: v.pipe(
          v.lazy(() => PostSchema),
          v.metadata({ ref: "user" })
        ),
      }),
      v.metadata({ ref: "post" })
    );

    const ContainerSchema = v.object({
      post: PostSchema,
    });

    const expected: Schema = {
      properties: {
        post: {
          $ref: "#/components/schemas/post",
        },
      },
      required: ["post"],
      type: "object",
    };

    const state = createOutputState();

    const result = createSchema(ContainerSchema);

    expect(result).toEqual(expected);

    const UserSchema = PostSchema.shape.user;
    const expectedUserComponent = {
      type: "complete",
      ref: "user",
      effects: [
        {
          type: "component",
          zodType: PostSchema,
          path: ["property: post", "property: user", "lazy schema"],
        },
      ],
      schemaObject: {
        $ref: "#/components/schemas/post",
      },
    };

    expect(state.components.schemas.get(UserSchema)).toEqual(
      expectedUserComponent
    );
  });
});
