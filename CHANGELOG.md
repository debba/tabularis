## [0.8.15](https://github.com/debba/tabularis/compare/v0.8.14...v0.8.15) (2026-02-21)


### Bug Fixes

* **ui:** hide set-empty button for blob fields ([989e5f9](https://github.com/debba/tabularis/commit/989e5f9dbda5497bad3949712b3811f36f18b714))


### Features

* **blob:** add blob parsing and payload helpers ([e5e6e66](https://github.com/debba/tabularis/commit/e5e6e66e69873bcda2e6499f04c4567718222ea8))
* **blob:** add image preview and fetch blob as data URL ([8e0d677](https://github.com/debba/tabularis/commit/8e0d677ecb2ef5fb91bea116390d43634fce065e))
* **blob:** enforce configurable max blob size and show errors ([86039cc](https://github.com/debba/tabularis/commit/86039ccb9caa725a4b3109ec8f519f1f10cdf3d1))
* **blob:** handle large BLOBs with backend truncation and UI support ([68848d5](https://github.com/debba/tabularis/commit/68848d5a722a9384bc7a0f5818ee499425ae9c0e)), closes [#36](https://github.com/debba/tabularis/issues/36)
* **blob:** improve large BLOB handling with preview wire format ([9de0a4e](https://github.com/debba/tabularis/commit/9de0a4ecc2d6cf49020698bb4fffc2f4de7bc9da))
* **pool-manager:** add default MySQL connection params ([f2fc644](https://github.com/debba/tabularis/commit/f2fc64413ec6754e838109cda425503b1aacce32))



## [0.8.14](https://github.com/debba/tabularis/compare/v0.8.13...v0.8.14) (2026-02-17)


### Bug Fixes

* **commands:** clear connection_id for temporary information_schema pool ([30f870e](https://github.com/debba/tabularis/commit/30f870e05263d57721f1c6dda01c243a70facc68))
* **connections:** disconnect active connection before deleting ([461b027](https://github.com/debba/tabularis/commit/461b0276a094ff56146e52286904626b2b0e6175))
* **mysql:** exclude views from get_tables query ([146f4af](https://github.com/debba/tabularis/commit/146f4afbc3fcd46d109edb2c79c594d31616a828))
* **ssh:** verify host keys, use accept-new, secure logging ([d8ab538](https://github.com/debba/tabularis/commit/d8ab538ee684c8fb1146e98d81f810aad88287ae))


### Features

* add split view, open editor, AI overlay; improve connection state ([bd98bea](https://github.com/debba/tabularis/commit/bd98beaea6db749a182c97b6465164198a296223))
* **connection:** add connection manager utils, hook, and UI components ([e58456b](https://github.com/debba/tabularis/commit/e58456bdcff0006fd0e7170c521012357e7f9bba))
* **editor:** relocate AI assist buttons to overlay and adjust padding ([0f346d8](https://github.com/debba/tabularis/commit/0f346d8af690f680b212f549342773e9b496c2af))
* **layout:** add split view layout with connection grouping ([903286f](https://github.com/debba/tabularis/commit/903286fbbee36862eaf26a42355fbf731fc99c5d))
* **layout:** add split view visibility control and panel close button ([b35e059](https://github.com/debba/tabularis/commit/b35e059163acbf32dfe8b2c12f50ab80fdcc8461))
* **layout:** replace connections icon and remove editor link ([23a7d8d](https://github.com/debba/tabularis/commit/23a7d8da1d1a489af3dfa20a9ea2189e4b72b629))
* **searchable-select:** render dropdown via portal with positioning ([396f384](https://github.com/debba/tabularis/commit/396f3844640d9e8741aaf9b72e628402fd3c634c))
* **sidebar:** add context menu to open connection in editor ([72614b7](https://github.com/debba/tabularis/commit/72614b791b48a21852f893cba2f44faf2ae2bb0e))



## [0.8.13](https://github.com/debba/tabularis/compare/v0.8.12...v0.8.13) (2026-02-15)


### Features

* **connections:** add disconnect command and provider handling ([622ab6c](https://github.com/debba/tabularis/commit/622ab6ca53f8b2b566c3fb0fdcadd096923dde9d))
* **database:** test connection before loading schemas ([001ea15](https://github.com/debba/tabularis/commit/001ea158670b9b882efcde980106e103d40aaabe))
* **drivers:** add data type registry and extraction modules ([c6e0d25](https://github.com/debba/tabularis/commit/c6e0d25adf66dc864fcb1b60631b8545090e6c79))
* **geometry:** add geometry parsing and WKB->WKT formatting ([6c4aaa5](https://github.com/debba/tabularis/commit/6c4aaa57f857e1ca550a1a763912ebf944956eac))
* **icons:** add Discord icon component and replace MessageSquare usages ([f453e1c](https://github.com/debba/tabularis/commit/f453e1cd4d6577033f56dfdd3d1a95c70c82048b))
* **mysql,postgres:** support raw SQL function inputs for spatial data ([dbcb5f2](https://github.com/debba/tabularis/commit/dbcb5f2e1e21da0d21cdbb293bda17675ad37cb3))
* **postgres,i18n:** add pg schema selection and Spanish locale ([d278718](https://github.com/debba/tabularis/commit/d27871806dcaa2ff3a70a387b055b91607bb6cbe))



## [0.8.12](https://github.com/debba/tabularis/compare/v0.8.11...v0.8.12) (2026-02-11)


### Bug Fixes

* **drivers-mysql:** use column indices for Windows/MySQL 8 ([8e30b8f](https://github.com/debba/tabularis/commit/8e30b8f6a2af61ef25e8dbc5c574705c2baa910e))


### Features

* **tauri:** integrate clipboard-manager plugin and editor paste ([0bc7a68](https://github.com/debba/tabularis/commit/0bc7a6891114a398ca5a07ba9e34b016c1a9daee))



## [0.8.11](https://github.com/debba/tabularis/compare/v0.8.10...v0.8.11) (2026-02-10)


### Bug Fixes

* **db:** allow empty inserts for auto-generated fields in insert_record ([5c34144](https://github.com/debba/tabularis/commit/5c3414424d38a742140bef4cce94ff6c4ea70fa8))
* **postgres:** read is_pk as bool instead of i64 ([90a95da](https://github.com/debba/tabularis/commit/90a95da42a76ffe2923db5a52e0a6e82d9edff3d))
* **ui-data-grid:** handle insertion row metadata and cleanup comments ([d54c3cb](https://github.com/debba/tabularis/commit/d54c3cb2cc4b0c8ff85587047e5ed2ebc8547ddd))
* **ui:** show database load error below database select ([fe6d7eb](https://github.com/debba/tabularis/commit/fe6d7eb929b70d8a206d770f2fbd21fe00b9e31f))


### Features

* **community:** add community modal and Discord link ([d031009](https://github.com/debba/tabularis/commit/d031009eacb7ebf9895172b5e4dc2430d6ac5a8d))
* **data-grid:** add cell display utils and styling helpers ([759b80c](https://github.com/debba/tabularis/commit/759b80c46e6a8870a6fb82884f5409978b851b2e))
* **data-grid:** add DEFAULT sentinel handling and cell value actions ([b89eed5](https://github.com/debba/tabularis/commit/b89eed5cbb4c93a4087d764d99dd40259768b0c4))
* **data-grid:** add edit and mark-for-deletion actions in context menu ([7e7426c](https://github.com/debba/tabularis/commit/7e7426ced0e90359b60e7f4d490db34d88305990))
* **db:** implement default value retrieval for MySQL and PostgreSQL ([ac7ecd5](https://github.com/debba/tabularis/commit/ac7ecd59593f8addf6f02e52c1c8a8d7d0fad8cd))
* **drivers-postgres:** add extended PostgreSQL metadata functions and ([4f91dbb](https://github.com/debba/tabularis/commit/4f91dbb7ecc5b4f1ab25b43c7407980d2908c0a5))
* **editor:** add global Ctrl+F5 shortcut to run queries ([895bfb6](https://github.com/debba/tabularis/commit/895bfb669ea2d82d4e0422988c90ff53c9a10bc5))
* **editor:** add pending insertions support ([c4c6ad9](https://github.com/debba/tabularis/commit/c4c6ad95c75e582860e16d842c2f142765baf2d2))
* **editor:** add table run prompt and fallback query handling ([483fdd4](https://github.com/debba/tabularis/commit/483fdd4fbd7622d9ac41bf8447018d7f25f133dc))
* **editor:** display discard option and handle auto-increment defaults ([bb60012](https://github.com/debba/tabularis/commit/bb600123a1e936bd3085333cdf3d8f6936e4c9a1))
* **prefs:** add editor preferences persistence via tauri backend ([9b481d9](https://github.com/debba/tabularis/commit/9b481d918feba2ce4c8aa8f2b1ed5dcc59c72580))
* **roadmap:** add links to roadmap and make items openable ([77f7995](https://github.com/debba/tabularis/commit/77f7995ba4b26d017f467cc74ab0647c76815bd5))
* **roadmap:** add roadmap sync workflow and update scripts ([2a8c48d](https://github.com/debba/tabularis/commit/2a8c48d3bf02f9e6124b9526a3d899a7eddf051d))
* **ui-datagrid:** add tab key navigation between cells ([e101191](https://github.com/debba/tabularis/commit/e1011918488319af50a479f957ba11bf8c0ade49))



## [0.8.10](https://github.com/debba/tabularis/compare/v0.8.8...v0.8.10) (2026-02-08)


### Bug Fixes

* **keychain:** log errors to stderr in get_ai_key ([a4ad95a](https://github.com/debba/tabularis/commit/a4ad95ae20ccd9a57d59ca4ca00ba55ab674c6b8))
* **mcp:** update cross-platform directory handling for project paths ([3ae677c](https://github.com/debba/tabularis/commit/3ae677c513591723688398fbc19ed76314bc6fee))
* **modals:** update ModifyColumnModal SQL generation and submission ([e8c9e15](https://github.com/debba/tabularis/commit/e8c9e1506c465d303a5acbb53f8a0542f436c228))


### Features

* **ai:** add delete AI key command and status API ([ce295bd](https://github.com/debba/tabularis/commit/ce295bdae780c9a4f1b6f69837b567de3f13672a))
* **cli:** add debug mode logging flag to enable verbose logging ([5b24e74](https://github.com/debba/tabularis/commit/5b24e7408b8c48879c80bba0503fa09454e6dc92))
* **connection:** add list databases feature for MySQL, PostgreSQL, ([64816a8](https://github.com/debba/tabularis/commit/64816a84640e6bebbe3b79247f3cf2e7b40369a9))
* **custom-openai:** add support for custom OpenAI-compatible API configuration ([3e80a07](https://github.com/debba/tabularis/commit/3e80a07d9bf8324cb3bd659342555fb593c39672))
* **er-diagram:** add configurable default layout setting in schema ([f45ad8f](https://github.com/debba/tabularis/commit/f45ad8f195e9314b6a85426e14113a7abb78c2d5))
* **er-diagram:** add table focus, layout toggle, and context menu ([6f0b997](https://github.com/debba/tabularis/commit/6f0b9971b3ba96c5a49e2916e108add952a6eed6))
* **logger:** add in-memory log capture and log commands for management ([e551749](https://github.com/debba/tabularis/commit/e5517499a27dc6173ae8adcb63702baad446321d))
* **modal:** update driver reset logic in connection form ([0e47969](https://github.com/debba/tabularis/commit/0e4796906775c2756f3b7f0aa9da094ca70ba0e6))
* **pool:** add stable pooling with connection_id for SSH tunnels ([2faf727](https://github.com/debba/tabularis/commit/2faf727431c9b74672a21b33a6747c1096d29e7f))
* **readme:** add OpenAI-compatible APIs section and sync roadmap ([651de87](https://github.com/debba/tabularis/commit/651de87eb44c1b09bd3600b63ea6e235288fc944))
* **routines:** add commands to fetch routines and their details ([a1ab2d2](https://github.com/debba/tabularis/commit/a1ab2d2b1e5f7a35c03e0231976bccbf384fb61f))
* **sidebar:** add refresh tables button ([21c6c6f](https://github.com/debba/tabularis/commit/21c6c6ffa7912456e545410b578eb54200eee0f5))
* **sql:** add identifier escaping helpers for MySQL, Postgres, and ([79f1ac4](https://github.com/debba/tabularis/commit/79f1ac473a7f31997266f776ac010cd92a8484da))
* **tauri:** add debug mode flag with is_debug_mode command ([c814a66](https://github.com/debba/tabularis/commit/c814a66569ab527d7b6d2d16c531e2ec84534f16))
* **tauri:** add devtools commands and auto-open in debug mode ([af698bf](https://github.com/debba/tabularis/commit/af698bf1363b6001554db4ae18f535dcdadfcc42))
* **updater:** add automatic update checking and install support ([0bd16ad](https://github.com/debba/tabularis/commit/0bd16ad719073925dc4663fe839ed5cd0f4145de))
* **view:** add database view management commands and UI components ([48b558d](https://github.com/debba/tabularis/commit/48b558dba1ccc9813a111013f4b123b571c50d60))



## [0.8.9](https://github.com/debba/tabularis/compare/v0.8.8...v0.8.9) (2026-02-06)


### Bug Fixes

* **keychain:** log errors to stderr in get_ai_key ([a4ad95a](https://github.com/debba/tabularis/commit/a4ad95ae20ccd9a57d59ca4ca00ba55ab674c6b8))
* **mcp:** update cross-platform directory handling for project paths ([3ae677c](https://github.com/debba/tabularis/commit/3ae677c513591723688398fbc19ed76314bc6fee))


### Features

* **ai:** add delete AI key command and status API ([ce295bd](https://github.com/debba/tabularis/commit/ce295bdae780c9a4f1b6f69837b567de3f13672a))
* **connection:** add list databases feature for MySQL, PostgreSQL, ([64816a8](https://github.com/debba/tabularis/commit/64816a84640e6bebbe3b79247f3cf2e7b40369a9))
* **custom-openai:** add support for custom OpenAI-compatible API configuration ([3e80a07](https://github.com/debba/tabularis/commit/3e80a07d9bf8324cb3bd659342555fb593c39672))
* **logger:** add in-memory log capture and log commands for management ([e551749](https://github.com/debba/tabularis/commit/e5517499a27dc6173ae8adcb63702baad446321d))
* **modal:** update driver reset logic in connection form ([0e47969](https://github.com/debba/tabularis/commit/0e4796906775c2756f3b7f0aa9da094ca70ba0e6))
* **readme:** add OpenAI-compatible APIs section and sync roadmap ([651de87](https://github.com/debba/tabularis/commit/651de87eb44c1b09bd3600b63ea6e235288fc944))
* **sidebar:** add refresh tables button ([21c6c6f](https://github.com/debba/tabularis/commit/21c6c6ffa7912456e545410b578eb54200eee0f5))
* **tauri:** add debug mode flag with is_debug_mode command ([c814a66](https://github.com/debba/tabularis/commit/c814a66569ab527d7b6d2d16c531e2ec84534f16))
* **updater:** add automatic update checking and install support ([0bd16ad](https://github.com/debba/tabularis/commit/0bd16ad719073925dc4663fe839ed5cd0f4145de))



## [0.8.8](https://github.com/debba/tabularis/compare/v0.8.7...v0.8.8) (2026-02-04)


### Features

* **components:** refactor SSH connections modal logic ([732af14](https://github.com/debba/tabularis/commit/732af14edd7b473ce90452b8a85c6cefd34ab418))
* **database:** add dump and import utilities ([5927e04](https://github.com/debba/tabularis/commit/5927e049248314e8cdd8c79618606c47fb0acca1))
* **datagrid:** add copy row and selected cells functionality ([1159299](https://github.com/debba/tabularis/commit/1159299126a2fb506b55e45028046dfeb29119ed))
* **editor:** add middle-click tab close functionality ([8a08abc](https://github.com/debba/tabularis/commit/8a08abc08881be6b37c9b28932b01e7fa4d89ac3))
* **sidebar:** add accordion, nav item, table item, resize hook, types ([173aa12](https://github.com/debba/tabularis/commit/173aa12a6093eea615f03c67586d1ed6d2a78c65))
* **sidebar:** add responsive actions dropdown for narrow sidebars ([65f166d](https://github.com/debba/tabularis/commit/65f166d8132e6d9025a4c0ed229856d9ac966715))
* **ssh:** add SSH connections management support ([9f0f8be](https://github.com/debba/tabularis/commit/9f0f8be7d1d6c74f2a0bad9ae7092e63fa83a6c1))
* **ssh:** enhance SSH connection credential handling ([6c4f277](https://github.com/debba/tabularis/commit/6c4f277c348c4ec4bb2c0c196f1cfbc6e41578fe))
* **ssh:** improve SSH connection management and validation ([ec12241](https://github.com/debba/tabularis/commit/ec12241e7a97c83b2b150f80bc0f41c41f88921d))
* **ui:** enhance connection modal status feedback ([fc02ce6](https://github.com/debba/tabularis/commit/fc02ce6a2e76f0bde6b97384b2d229085a1d380e))



## [0.8.7](https://github.com/debba/tabularis/compare/v0.8.6...v0.8.7) (2026-02-03)


### Features

* **ai:** add new model entries and centralize API key retrieval ([c0fdeeb](https://github.com/debba/tabularis/commit/c0fdeeba71bdacb1907a174dbe992d8956eb5d88))
* **ai:** add Ollama provider with dynamic model fetching and caching ([fd30ab5](https://github.com/debba/tabularis/commit/fd30ab5a9a32efd5617b2773ab9b1ba4e9872cc0))



## [0.8.6](https://github.com/debba/tabularis/compare/v0.8.5...v0.8.6) (2026-02-02)


### Features

* **ui:** add context menu positioning utils and SQL generator utilities ([9d63a37](https://github.com/debba/tabularis/commit/9d63a371d4ad7c8707801efd620d607cf206a53d))
* **utils:** add settings and theme management utilities ([952d651](https://github.com/debba/tabularis/commit/952d651e74bfb920550210f1f1cea690466387bf))
* **utils:** add visual query SQL generator and table toolbar helpers ([ca44962](https://github.com/debba/tabularis/commit/ca4496219173dd028f54242d8e8d28a71c2b886d))
* **utils:** extract and add testable utility modules with unit tests ([369a9af](https://github.com/debba/tabularis/commit/369a9afad461ae8d456213c2ea6de05c4ee73a47))



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



