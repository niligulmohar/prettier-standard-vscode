# Changelog

## [1.0.2]

- Stop loading in eslint from the local project when available. We aren't using any local config yet anyway so there's no point in loading in the custom eslint version. And it's causing some issues. Fixes #58

## [1.0.1]

- fixed bug preventing formatting of tailwindcss files
- run vue files through eslint

## [1.0.0]

- Replaced prettier-standard with prettier and eslint. We will load in and honor your prettier version/config/plugins/ignorelist if they exist. One day we hope to do the same for eslint. For now we we just apply the `space-before-function-paren` rule and run it through --fix. I couldn't think of what else standard changes from base prettier so please file an issue if you find a missing rule.

## [0.9.2]

- I am bad at publishing versions. Many apologies. Trying again

## [0.9.1]

- Revert 0.9.0. Worked great in debug mode but got a weird error when running packaged. IT WILL BE BACK!

## [0.9.0]

- Update to a forked version of prettier-standard with updated dependencies

## [0.8.1]

- Fix issue where .tsx files wouldn't format immediately after opening the editor

## [0.8.0]

- Allow formatting the vscode settings json
- Switch to the typescript formatter for .ts and .tsx files
- Upgraded prettier-standard to 16.3.0

## [0.7.0]

- Add support for jsonc files
- Add support for tsx files
- Use our built-in prettier-standard if the project's version is outdated

## [0.6.0]

- Move project from typescript to javascript
- Use the prettier-standard cli here: https://github.com/sheerun/prettier-standard
- Remove all config options and use .prettierrc instead

## [0.5.0]

- Add prettier.arrowParens config
- Removed prettier.tabWidth and prettier.singleQuote configs as standard overrides them anyway

## [0.4.0]

- Bumps prettier to 1.15.2
- Bumps standard to 12.0.1

## [0.3.0]

- Fixes issue that would kill formatting in certain cases
- Bumps prettier to 1.2.2
- Bumps standard to 10.0.2

## [0.2.0]

- Bumps prettier to 1.1.0

## [0.1.0]

- Initial release
