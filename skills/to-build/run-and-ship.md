# Run the app and ship

The lead follows this file. It is used to take screenshots for the report, when the user asks to try the change, and when the user asks to ship.

## Run the app

- Start it with the project's dev command. Other checkouts may already be running, so pick free ports when the defaults are taken, and point the parts at each other.
- Create local config from the example files. Keep it out of git, and seed a known user.
- Smoke-test one request.
- For the report, take a screenshot of every scenario that shows UI, at desktop and phone width, named by scenario ID.
- For every scenario that calls an endpoint, run it with `curl -i` (or `curl -v` when request headers matter) and save the command, the request and the full response. Replace tokens, cookies and passwords with `<redacted>`.
- When the user wants to try it themselves, report the URLs, the credentials and what to try.
- If the user wants to try it from another device, expose the app on the network they name and leave existing forwards alone.
- Stop the dev server before running tests that need its ports or build folder, and say that you did.
- Leave the user's data alone, and delete what you created.

## Ship

Only when the user asks. The test, feat and refactor commits already exist on the feature branch.

1. Stop the servers you started.
2. Merge into the branch the user names. The target differs between projects: `master`, `main`, or a team branch. Read the real name from git, and ask when the user did not name one. Merge in the checkout that has the target branch checked out. Fast-forward when you can. When you can't, say so before you create a merge commit or rebase.
3. Run the **Definition of done** commands for categories 1 to 6 again on the target.
4. Push only when asked.
5. Report the commits, how the merge went, and what you left behind (local config, databases).
