## [0.8.5](https://github.com/debba/tabularis/compare/v0.8.4...v0.8.5) (2026-02-01)


### Bug Fixes

* **backend:** prepend app name to ER diagram window title ([c3c652c](https://github.com/debba/tabularis/commit/c3c652cf164042b08fef95dc466be88826406304))
* **sidebar:** add error handling for index deletion and i18n messages ([346adc8](https://github.com/debba/tabularis/commit/346adc8f43479e9767925910f72e220ca6893cd0))


### Features

* **editor:** add apply-to-all toggle for batch updates ([e5e5aa8](https://github.com/debba/tabularis/commit/e5e5aa8bd20ac30e42ef32ebe90b52933416eebb))
* **sidebar:** add Generate SQL modal for tables ([0c077ca](https://github.com/debba/tabularis/commit/0c077caabefe2f0983f29eb829a9456227e65c53))



## [0.8.4](https://github.com/debba/tabularis/compare/v0.8.3...v0.8.4) (2026-02-01)


### Features

* **i18n:** add themeSelection translation key ([43daa61](https://github.com/debba/tabularis/commit/43daa613fa6e64349373a770e715234e0a024fc6))
* **settings:** add configurable font family and size ([7daf6ef](https://github.com/debba/tabularis/commit/7daf6efa792fd44f54d1c42bfc8214c6f8150826))
* **settings:** add font family selection and lazy-loaded fonts ([8a0e61a](https://github.com/debba/tabularis/commit/8a0e61a23b4bb2815eacc25d8f82f25ecf7144b8))
* **settings:** add localization tab and gallery images ([bb00a26](https://github.com/debba/tabularis/commit/bb00a26932f30c92a6d05f7791d7417f5131555e))
* **settings:** improve AI config handling and detection ([b9d0831](https://github.com/debba/tabularis/commit/b9d08315b432550b7f48e16c0d1a3cbd743d1556))
* **theme:** add font settings and ai custom models to app config ([8e849e2](https://github.com/debba/tabularis/commit/8e849e2fa8fe1b56f985c44f4317d0468be18cda))
* **theme:** apply dynamic theme colors to sidebar and settings logos ([cc23fab](https://github.com/debba/tabularis/commit/cc23fabfa3c151b85beacd826ffde13e6e0209d6))
* **theme:** implement theme system with CSS variables and provider ([55f8905](https://github.com/debba/tabularis/commit/55f89058e635dbaefc112ccb39f449a496dc962f))
* **theme:** integrate monaco-themes and add new preset themes ([9154510](https://github.com/debba/tabularis/commit/9154510b627deafb0d9f2f903e90c39e36818920))
* **ui:** add modal styling rules, SqlPreview component and splash ([f74f063](https://github.com/debba/tabularis/commit/f74f063ea49fc84a6bff4c8b648caa26fab736f4))



## [0.8.3](https://github.com/debba/tabularis/compare/v0.8.2...v0.8.3) (2026-01-31)



## [0.8.2](https://github.com/debba/tabularis/compare/v0.8.1...v0.8.2) (2026-01-31)


### Features

* **er-diagram:** add window command and page for schema diagrams ([676b41f](https://github.com/debba/tabularis/commit/676b41f62c1a92f46dcd09905f6a0f8d78a95d4e))
* **schema-diagram:** add refresh UI and encode ER diagram parameters ([61b8b00](https://github.com/debba/tabularis/commit/61b8b00490453c27b277a6e32298b4dfb6320776))
* **schema:** add schema diagram UI with backend snapshot ([72849e8](https://github.com/debba/tabularis/commit/72849e8303f5c0e64517e78380941b16b2f46de4))


### BREAKING CHANGES

* **er-diagram:** remove `schema_diagram` tab type from editor tabs



## [0.8.1](https://github.com/debba/tabularis/compare/v0.8.0...v0.8.1) (2026-01-30)


### Features

* **connections:** add connection loading state ([36a72d2](https://github.com/debba/tabularis/commit/36a72d2cef2cc2596bd9cab9db327c07b1cf0697))
* **editor:** add convert to console action and translations ([c3ad2b2](https://github.com/debba/tabularis/commit/c3ad2b2907cc0438b6df5c5e13545fe00e12bb6c))
* **modal:** add run mode to query params modal ([a8af1c3](https://github.com/debba/tabularis/commit/a8af1c36645edb1a4f80da874dd3858e3de2bd9a))
* **query:** add parameterized query support ([9fd2fbc](https://github.com/debba/tabularis/commit/9fd2fbccc847b7b85cd604880526718eaf97744d))
* **sql:** preserve ORDER BY clause during pagination ([a963c28](https://github.com/debba/tabularis/commit/a963c28b89a3ae68b194e26bddedfb873eade2e1))
* **ui:** add column sorting in DataGrid ([896658c](https://github.com/debba/tabularis/commit/896658c76f13a21769a5574ae990097aac17f9db))
* **ui:** add virtualized data grid and SQL editor wrapper ([30a9099](https://github.com/debba/tabularis/commit/30a9099dbe48d608972c33b2c9c7ea7a4bbc2814))
* **ui:** enhance table interaction with click and double-click actions ([eccc881](https://github.com/debba/tabularis/commit/eccc881cd5425b1acf22a38aaa4d483d40b325da))



# [0.8.0](https://github.com/debba/tabularis/compare/v0.7.1...v0.8.0) (2026-01-29)


### Features

* **ai:** add AI integration with backend, settings UI, and docs ([0ff1899](https://github.com/debba/tabularis/commit/0ff1899ab502327faaf279f511d824aaa4d8f7b6))
* **ai:** add AI query generation and explanation support ([370f1e8](https://github.com/debba/tabularis/commit/370f1e846c5a98ed2b49c7b963761ce440ce3d46))
* **ai:** add dynamic model loading with fallback and experimental flag ([702103e](https://github.com/debba/tabularis/commit/702103efd253b0f5f851fed2054a885f1fb0cf80))
* **drivers:** add table sorting for all database types ([beb8abc](https://github.com/debba/tabularis/commit/beb8abc095d9729eedd7da24d6235657ab78874d))
* **editor:** add DataGrip‑style SQL autocomplete and enable word wrap ([fb1d252](https://github.com/debba/tabularis/commit/fb1d252adec6a36e2abd1c3a9ec756820a5382fd))
* **export:** add query result export to CSV and JSON ([e283aa1](https://github.com/debba/tabularis/commit/e283aa14fc310343fe6f8aae5320dfd83e787bc8))
* **mcp:** add MCP server integration with UI and config handling ([8d61571](https://github.com/debba/tabularis/commit/8d615714966801d39d3e074c0ee831d2ca6e525a))
* **mcp:** add name support for connection resolution ([f01d685](https://github.com/debba/tabularis/commit/f01d68512c8227c06a1de97bb928c2532e87b8af))



## [0.7.1](https://github.com/debba/tabularis/compare/v0.7.0...v0.7.1) (2026-01-29)


### Bug Fixes

* **editor:** clear pending state when running query ([fe3354b](https://github.com/debba/tabularis/commit/fe3354b98d70475e776c7ea201fc3576dec17b68))


### Features

* **database:** implement connection pool manager ([8ea4278](https://github.com/debba/tabularis/commit/8ea4278bebfd4b3fcc83da014fa48651c06c0145))
* **table-view:** enhance filtering with dynamic placeholders and limit ([cfc5f53](https://github.com/debba/tabularis/commit/cfc5f531aca00a7b699e9f4c7e6d5eaee58bd7a0))
* **ui:** enhance table view with full-screen mode and filters ([b528821](https://github.com/debba/tabularis/commit/b528821b6806802178c4c1faff076936977b7ec3))



# [0.7.0](https://github.com/debba/tabularis/compare/v0.6.1...v0.7.0) (2026-01-29)


### Features

* **data-grid:** improve table extraction and cell rendering ([fd21915](https://github.com/debba/tabularis/commit/fd21915983ddfb85b40a4d432c4cccea8c551ee0))
* **drivers:** enhance multi-database decimal and null value handling ([4d49f66](https://github.com/debba/tabularis/commit/4d49f66eb407f8b9b59d11efc645655d16bf7a95))
* **drivers:** improve datetime parsing and formatting ([74c394b](https://github.com/debba/tabularis/commit/74c394b8ae1852bba70f60bbdee7665d1b066b99))
* **editor:** improve query execution loading state ([d1decc1](https://github.com/debba/tabularis/commit/d1decc1f46d79bc4b557c8b80d10191890e2610a))
* **settings:** fix external links by using opener plugin ([11acdb5](https://github.com/debba/tabularis/commit/11acdb520aa7e93f9eb04f8f824e6c0e3a87ceeb))
* **ui:** implement batch editing with pending changes and deletions ([cb6aecb](https://github.com/debba/tabularis/commit/cb6aecb319a857d7e300bd50f378ffa2bdd9472d))
* **website:** add landing page and sync version handling ([471bf68](https://github.com/debba/tabularis/commit/471bf682ac06a0882a26f296b2e4101bf45c1b18))



## [0.6.1](https://github.com/debba/debba.sql/compare/v0.6.0...v0.6.1) (2026-01-28)


### Features

* **version:** add APP_VERSION export and sync script ([54aeaa6](https://github.com/debba/debba.sql/commit/54aeaa6274cc9e906b016b24ffd91ef38881e129))



# [0.6.0](https://github.com/debba/debba.sql/compare/v0.5.0...v0.6.0) (2026-01-28)


### Features

* **i18n:** add internationalization support and bump version to 0.6.0 ([e1cab12](https://github.com/debba/debba.sql/commit/e1cab1255165c8133d929cc075c08900fc7a3067))
* **security:** integrate system keychain for connection passwords ([ab284b5](https://github.com/debba/debba.sql/commit/ab284b52d7fc204c4551ec66c5cd8c34c404ca81))
* **window:** add Wayland window title workaround for Linux ([c09ae72](https://github.com/debba/debba.sql/commit/c09ae7261ed88f3924a84e3e8b00f470176f07af))



# [0.5.0](https://github.com/debba/debba.sql/compare/v0.4.0...v0.5.0) (2026-01-27)


### Bug Fixes

* restore pagination controls and fix truncated flag scope ([1bdf104](https://github.com/debba/debba.sql/commit/1bdf104c37c057f183ed9f37f97abd40b31fbd66))


### Features

* release v0.5.0 - Advanced Schema Management & UX Improvements ([f2d7d1c](https://github.com/debba/debba.sql/commit/f2d7d1c841ef6a0d62b22e8ec27bef8ef845113e))
* **schema:** add foreign key, index structs and: column edit UI ([c20c550](https://github.com/debba/debba.sql/commit/c20c550c3661bcc8dd0dbb09e02149fdf92ccaef))
* **sidebar:** add column explorer with delete action ([b25cd50](https://github.com/debba/debba.sql/commit/b25cd508aef8d58f0894976068d9ee5621f69e9a))
* **ui:** add multi-row selection and select-all column to DataGrid ([66ddfaa](https://github.com/debba/debba.sql/commit/66ddfaa86c01dc73c452bb04d2608cfdc640c07a))



# [0.4.0](https://github.com/debba/debba.sql/compare/v0.3.0...v0.4.0) (2026-01-27)


### Features

* **ci:** add readme downloads workflow ([d48ef6b](https://github.com/debba/debba.sql/commit/d48ef6bb77e9a654b8081080eb0f40756dcef280))
* **editor:** add DataGrip-style multiple query tabs with isolation ([688739a](https://github.com/debba/debba.sql/commit/688739aac8eb995e1329943ef43e290d8b503f8d))
* **visual-query-builder:** add delete table node UI and auto GROUP BY ([0f1f9be](https://github.com/debba/debba.sql/commit/0f1f9bebd9143f9d155c0790628acf199cd79e24))
* **visual-query-builder:** add visual query builder UI ([f97b67a](https://github.com/debba/debba.sql/commit/f97b67a459dd3d7e4465622c2702bbfdd1439e99))



# [0.3.0](https://github.com/debba/debba.sql/compare/v0.2.0...v0.3.0) (2026-01-27)


### Features

* **connection:** add duplicate connection command and clone button ([4e00382](https://github.com/debba/debba.sql/commit/4e003828a491c18a2d348a6efcc86ccfffcadcc2))



# [0.2.0](https://github.com/debba/debba.sql/compare/3a9fc495d44cdd907d5f561a73d5734d0ccb0590...v0.2.0) (2026-01-27)


### Bug Fixes

* **drivers:** support additional numeric types and correct row mapping ([0769f3b](https://github.com/debba/debba.sql/commit/0769f3b4ed38fe2a531ff9ac7b6affed70af75b2))


### Features

* add query cancellation, sanitization, and multi‑statement support ([403956a](https://github.com/debba/debba.sql/commit/403956ab596a3808d9fcb65358bcbaf857cba1ed))
* **connections:** add error handling UI and propagate connection errors ([3494021](https://github.com/debba/debba.sql/commit/34940210025808434ea7c333263714792ae03b02))
* **editor:** add run dropdown and dynamic window title ([99b3d1c](https://github.com/debba/debba.sql/commit/99b3d1c3fba7b424533a4ebad4629d5bec1c5484))
* **pagination:** implement server‑side pagination and UI controls ([f50b110](https://github.com/debba/debba.sql/commit/f50b11001ac1eb82d310fcb23bc51c50881a9b52))
* **saved-queries:** add saved queries support ([9839737](https://github.com/debba/debba.sql/commit/9839737fc2d532e4e139226fc5e331f722ba57de))
* **settings:** implement query limit UI and backend streaming support ([9fd89f3](https://github.com/debba/debba.sql/commit/9fd89f3c3b3538b0d09fe8324e89ba4172339100))
* **ssh:** add SSH tunnel support with connection edit/delete UI ([3a9fc49](https://github.com/debba/debba.sql/commit/3a9fc495d44cdd907d5f561a73d5734d0ccb0590))
* **ssh:** add system SSH backend and URL encoding for DB URLs ([5e93ea3](https://github.com/debba/debba.sql/commit/5e93ea38f1a74966ab1a41f5ddda4e8cb13bb23c))



