# Contributing

Thanks for showing interest in contributing to Hono OpenAPI 💖, you rock!

When it comes to open source, you can contribute in different ways, all of which are valuable. Here are a few guidelines that should help you prepare your contribution.

## Setup the Project

The following steps will get you up and running to contribute to Hono OpenAPI:

1. Fork the repo (click the `Fork` button at the top right of [this page](https://github.com/rhinobase/hono-openapi))

2. Clone your fork locally

   ```sh
   git clone https://github.com/<your_github_username>/hono-openapi.git
   cd hono-openapi
   ```

3. Set up all the dependencies and packages by running `pnpm install`. This command will install dependencies.

> If you run into any issues during this step, kindly reach out to the Rhinobase team here: <https://discord.gg/YtzxUfCk8c>

## Development

To improve our development process, we’ve set up tooling and systems, and Hono OpenAPI uses a monorepo structure by `nx`.

### Tooling

- [PNPM](https://pnpm.io/) to manage packages and dependencies
- [NX](https://nx.dev/) to manage the monorepo, changelog generation, and release management
- [SWC](https://swc.rs/) to bundle packages

### Commands

**`pnpm install`**: bootstraps the entire project, symlinks all dependencies.

**`pnpm nx build [package name]`**: run build for a particular package.

**`pnpm nx run-many -t build`**: run build for all the packages.

## Think you found a bug?

Please follow the issue template and provide a clear path to reproduction with a code example. The best way to show a bug is by sending a CodeSandbox link.

## Proposing new or changed API?

Please provide thoughtful comments and some sample API code. Proposals that don't line up with our roadmap or don't have a thoughtful explanation will be closed.

## Making a Pull Request?

Pull requests need only the :+1: of two or more collaborators to be merged; when the PR author is a collaborator, that counts as one.

### Commit Convention

Before creating a Pull Request, ensure that your commits comply with the commit conventions used in this repository.

When you create a commit we kindly ask you to follow the convention `category(scope or module): message` in your commit message while using one of the following categories:

- `feat/feature`: all changes that introduce completely new code or new features
- `fix`: changes that fix a bug (ideally you will additionally reference an issue if present)
- `refactor`: any code-related change that is not a fix nor a feature
- `docs`: changing existing or creating new documentation (i.e. README, docs for the usage of a lib or CLI usage)
- `build`: all changes regarding the build of the software changes to dependencies, or the addition of new dependencies
- `test`: all changes regarding tests (adding new tests or changing existing ones)
- `ci`: all changes regarding the configuration of continuous integration (i.e. GitHub actions, ci system)
- `chore`: all changes to the repository that do not fit into any of the above categories

You can use `pnpm commit` command to help you with your commits

If you are interested in the detailed specification you can visit <https://www.conventionalcommits.org/> or check out the [Angular Commit Message Guidelines](https://github.com/angular/angular/blob/22b96b9/CONTRIBUTING.md#-commit-message-guidelines).

### Steps to PR

1. Fork the `hono-openapi` repository and clone your fork

2. Create a new branch out of the `main` branch. We follow the convention `[type/scope]`. For example `fix/memcache` or `docs/core`. `type` can be either `docs`, `fix`, `feat`, `build`, or any other conventional commit type. `scope` is just a short id that describes the scope of work.

3. Make and commit your changes following the [commit convention](https://github.com/rhinobase/hono-openapi/blob/main/CONTRIBUTING.md#commit-convention). As you develop, you can run `pnpm nx build [package name]` to make sure everything works as expected.

### Tests

All commits that fix bugs or add features need a test.

> **Dear Rhinobase team:** Please do not merge code without tests

## Want to write a blog post or tutorial

That would be amazing! Reach out to the core team here: <https://discord.gg/YtzxUfCk8c>. We would love to support you in any way we can.

## License

By contributing your code to the `hono-openapi` GitHub repository, you agree to license your contribution under the MIT license.
