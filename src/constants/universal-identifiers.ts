// ---------------------------------------------------------------------------
// NorthPeak Reports — central registry of stable universalIdentifiers (UUID v4).
//
// Every entity in a Twenty app is keyed by a universalIdentifier that must stay
// stable across syncs/deploys. Keeping them all in one import-free module avoids
// the circular-import problem that bidirectional relations otherwise hit
// (see docs/data/relations — "export field IDs as named constants").
// ---------------------------------------------------------------------------

// --- Application ------------------------------------------------------------
export const APP_DISPLAY_NAME = 'NorthPeak Reports';
export const APP_DESCRIPTION =
  'Turn a plain-language prompt into a validated report over your CRM data, ' +
  'arrange it with a drag-and-drop block builder, and email it to your team on a schedule.';
export const APPLICATION_UNIVERSAL_IDENTIFIER = '5934db94-a985-4ae6-8a28-35027bfab6e3';
export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER = 'd349e312-568e-4475-84a1-742bf9425e62';

// --- Application / server variables ----------------------------------------
export const APP_VAR_LLM_MODEL_ID = '73af49b3-b0a4-43fd-9051-5d30da01fcce';
export const APP_VAR_BREVO_SENDER_EMAIL_ID = '42abe694-f23a-4c27-9753-917586ea3502';
export const APP_VAR_BREVO_SENDER_NAME_ID = '64cf978c-2178-408d-a7dc-8667673ac474';
export const APP_VAR_PUBLIC_BASE_URL_ID = '102b16f3-391a-4dea-bcda-6ee4360280ce';

// --- Existing scaffold "app landing" page ----------------------------------
export const MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  'f073ea89-371f-4df9-bf92-f2d613da678a';
export const MAIN_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER = '4c169e10-6ec3-4751-b055-b61682142bca';
export const MAIN_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER = 'aff31bdb-0950-4fa0-9f05-0cf3e0660feb';
export const MAIN_PAGE_WIDGET_UNIVERSAL_IDENTIFIER = 'e4494dd2-866f-4084-b250-4446be7b3887';
export const MAIN_PAGE_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  '26111837-ffb2-4da9-8fb1-d186539a6edd';

// --- Report object + fields -------------------------------------------------
export const REPORT_OBJECT_ID = '8431d9bb-6efe-4871-8214-0b14ca747bfc';
export const REPORT_PROMPT_FIELD_ID = '403a8bfa-112b-4707-bcf1-e215c49e3d84';
export const REPORT_SPEC_FIELD_ID = '5574be98-f059-4f7f-a281-d9b89932da6a';
export const REPORT_SPEC_ENGLISH_FIELD_ID = '9693b886-a6dc-4e60-9f65-2cf64b9bfed1';
export const REPORT_LAYOUT_FIELD_ID = '0e34f433-6fbc-4252-89d9-537762838a0d';
export const REPORT_CHAT_HISTORY_FIELD_ID = '808ee808-72fb-41ac-a149-2ab664599dd4';
export const REPORT_NARRATIVE_FIELD_ID = '2c329897-899d-49e4-8ae9-c8fd1337d521';
export const REPORT_FREQUENCY_FIELD_ID = '597b75bc-0add-45c8-86c5-155278aeb548';
export const REPORT_SEND_HOUR_FIELD_ID = '1516cafc-ecc7-45fe-9e05-2092cf737cf0';
export const REPORT_NEXT_RUN_AT_FIELD_ID = 'b3fb5ba0-3f86-4122-a82a-56bcad9990ee';
export const REPORT_LAST_RUN_AT_FIELD_ID = '740c65e7-3917-4d19-b2da-f4e2f3dae188';
export const REPORT_VISIBILITY_FIELD_ID = '50b39054-5b7f-400f-bfe8-01d1fcb9c1da';
export const REPORT_STATUS_FIELD_ID = '5144e924-b1f3-4fec-b867-a56b50697dde';
export const REPORT_OWNER_FIELD_ID = 'a43ed5f7-da00-4d45-b77f-d95fd916257b';
export const REPORT_OWNER_REVERSE_FIELD_ID = 'af7c2cc2-de91-4ec8-9175-a4e732c52ea3';
export const REPORT_SUBSCRIPTIONS_FIELD_ID = 'db95da19-835f-42fe-bda3-4831215055f2';
export const REPORT_RUNS_FIELD_ID = 'ea8827ec-133f-43e7-b93c-9ccddec83cb4';
export const REPORT_TIMEZONE_FIELD_ID = 'aed24dfe-07ee-470b-aac3-edf1016e90a1';
export const REPORT_LAST_ERROR_FIELD_ID = '2324454c-5f75-4ee8-bb6b-a5eaa3e41ffe';
export const REPORT_TOUR_SEEN_FIELD_ID = 'c7e9a1d4-3f2b-4a6e-9c81-5d7e0b3a4f62';
export const REPORT_SEND_DAY_OF_WEEK_FIELD_ID = 'e2a5c918-7b3d-4c6f-9a41-2f8b6d0e5c73';
export const REPORT_SEND_DAY_OF_MONTH_FIELD_ID = '552ea2a3-7cb8-4b92-aa95-4a277469f31f';
// Per-recipient (row-level) scoping
export const REPORT_SCOPE_ENABLED_FIELD_ID = 'b7e2c1a4-3d5f-4e8a-9b2c-1f6d0a7e34b2';
export const REPORT_SCOPE_FIELD_NAME_ID = 'c8f3d2b5-4e6a-4f9b-8c3d-2a7e1b8f45c3';

// --- ReportSubscription object + fields ------------------------------------
export const REPORT_SUBSCRIPTION_OBJECT_ID = '49298842-f281-4d2e-a46b-634838f10fb2';
export const SUBSCRIPTION_REPORT_FIELD_ID = 'd7109d04-ebec-44ba-8f41-6ef0a73745a0';
export const SUBSCRIPTION_MEMBER_FIELD_ID = '54f57bfd-5889-4346-9118-7f10c181bb63';
export const SUBSCRIPTION_MEMBER_REVERSE_FIELD_ID = '21bf1d23-7ab9-4cf6-9c8d-72b73e54ddf8';
export const SUBSCRIPTION_SCOPE_MODE_FIELD_ID = 'd9a4e3c6-5f7b-4a1c-9d4e-3b8f2c9a56d4';

// --- ReportRun object + fields ---------------------------------------------
export const REPORT_RUN_OBJECT_ID = '6e36f58d-e94c-4b3d-9266-4ed53337d8f2';
export const RUN_REPORT_FIELD_ID = 'acc7771c-f73d-42fa-a392-01fc9c6a7a3d';
export const RUN_STATUS_FIELD_ID = 'b4e517d1-df80-459c-9edf-e5f5b24bec4e';
export const RUN_RAN_AT_FIELD_ID = '844083d0-6058-4130-97be-1d72527a4442';
export const RUN_DATA_AS_OF_FIELD_ID = '463791e5-72aa-446c-80cf-07f1b63e4224';
export const RUN_ROW_COUNT_FIELD_ID = 'a578aff9-74f5-4f20-85bd-7a1bc48d1767';
export const RUN_RECIPIENT_COUNT_FIELD_ID = '25d91795-ad3c-43b1-88b7-824aa1e76d44';
export const RUN_RECIPIENTS_FIELD_ID = '5315eba1-e8b9-45d9-af0d-8489194f8740';
export const RUN_TRIGGER_FIELD_ID = '09ae5371-4698-478c-acca-7b54af684236';
export const RUN_ERROR_FIELD_ID = '24ee2211-2b60-4a04-a228-7945bd2eaef2';
export const RUN_SPEC_ENGLISH_FIELD_ID = '7521a52b-a595-46e9-84b3-b02f46ff6b8d';

// --- Views ------------------------------------------------------------------
export const REPORTS_VIEW_ID = '5a36d960-3d81-48ef-a901-5a105077123f';
export const REPORTS_VIEW_FIELD_NAME_ID = 'aa4312f1-aacf-4fa3-b132-2d248d84ce5c';
export const REPORTS_VIEW_FIELD_STATUS_ID = 'c5fc6067-94e0-4dcb-bce2-4097f2565f2a';
export const REPORTS_VIEW_FIELD_FREQ_ID = 'eb5edfa5-f717-47ae-b56f-1b4ef36c74fa';
export const REPORTS_VIEW_FIELD_NEXTRUN_ID = '5a39568d-5278-49b0-976b-804ea32809fa';
export const REPORTS_VIEW_FIELD_VISIBILITY_ID = '6e27762a-d655-468e-8d53-f3fa86a97092';

export const RUNS_VIEW_ID = '37fa59eb-d04d-435e-bf44-21a349385f6a';
export const RUNS_VIEW_FIELD_NAME_ID = '46c4cb41-937a-45ec-9616-0d1ff49bfd3b';
export const RUNS_VIEW_FIELD_STATUS_ID = 'a7b5064d-41d2-44d4-b557-d8fb5566dee5';
export const RUNS_VIEW_FIELD_RANAT_ID = 'e2f4b60d-4185-4a67-a2cb-724f6007b835';
export const RUNS_VIEW_FIELD_ROWCOUNT_ID = '62dafb22-0f99-477d-93a7-080a96a69985';
export const RUNS_VIEW_FIELD_RECIPIENTS_ID = '193a3098-e489-477f-bd0f-9fe238a3d131';

export const SUBSCRIPTIONS_VIEW_ID = 'cab94fcc-2a38-4298-9041-68883bf30af9';
export const SUBSCRIPTIONS_VIEW_FIELD_NAME_ID = 'fe0d7a86-85ec-4b6e-8230-1ee61eeff140';

// --- Navigation -------------------------------------------------------------
export const NAV_FOLDER_ID = 'ac6662c3-8eaa-411e-a195-659a12f57bb0';
export const NAV_REPORTS_ID = 'ec3f9a40-810f-4644-a49d-dcc1862fd730';
export const NAV_RUNS_ID = 'd233fd36-610a-4fc9-82c4-1568c6df9058';
export const NAV_SUBSCRIPTIONS_ID = '689cb20d-1b76-4d54-80ec-1505acf60545';

// --- Report record page layout ---------------------------------------------
export const REPORT_PAGE_LAYOUT_ID = 'b1a0718a-1768-42c1-b75d-485e49c7f0ac';
export const REPORT_PAGE_TAB_BUILDER_ID = 'f8f86f09-8653-4d71-b9f2-eac2ef6a7a92';
export const REPORT_PAGE_WIDGET_BUILDER_ID = '75f0dd3d-7dc5-495c-bf21-45027f3f5834';

// --- Front components -------------------------------------------------------
export const REPORT_BUILDER_FC_ID = '0fb887c6-06e4-42df-9ef9-600465550895';
export const CREATE_REPORT_FC_ID = '3841025f-3ff6-410a-b811-b6fa49e102c3';

// --- Command menu -----------------------------------------------------------
export const CREATE_REPORT_CMD_ID = '4ca5e5d9-d43b-4bf2-a0a3-d7ee7db996d0';

// --- Logic functions --------------------------------------------------------
export const LF_GENERATE_SPEC_ID = '740658b8-9d97-4f8b-92f6-6ef24380b0ca';
export const LF_RUN_REPORT_ID = '50eab552-1cfa-4ca5-a9f8-718d653336a0';
export const LF_DISPATCH_ID = '19a83ed9-59b3-4044-9c68-57a91a4572ca';
export const LF_CREATE_REPORT_ID = '2064f0a5-ddae-4b59-b8ce-4995af8f5288';
export const LF_ARRANGE_REPORT_ID = 'c1e7a4d2-3b8f-4e6a-9c15-7f2d0a9b4e63';
export const LF_LIST_OBJECTS_ID = 'a1502f99-e47c-42b0-842f-bcd5510c8840';
export const LF_LIST_SCOPE_FIELDS_ID = 'd3f6b2a1-7c4e-4a9b-8f21-3e5c9a0b1d47';
export const LF_POST_INSTALL_ID = 'b7eb9186-6e69-432b-8efa-75013e6de41c';

// --- Reporting-dimension fields added to standard objects ------------------
export const COMPANY_INDUSTRY_FIELD_ID = '1cf8f3a0-4322-4b91-9f3c-7e593fc2863c';
export const COMPANY_REGION_FIELD_ID = '35a99cf6-f309-44c5-a713-59f3f94b73f6';
export const OPP_LEAD_SOURCE_FIELD_ID = '958122b7-9730-45df-9a3c-aff92dfbabe0';
export const OPP_PRODUCT_TIER_FIELD_ID = '050b41ef-06ec-4939-8c49-d085c2411d67';
export const OPP_REGION_FIELD_ID = 'd6712b04-c722-4fb7-a6d1-4457652ad7a9';

// --- Member-relation "scope by" field for per-recipient scoping -------------
// Standard Company (accountOwner), Task (assignee) and Opportunity (owner)
// already relate rows to a workspace member; Person did not, so per-recipient
// scoping was impossible over it. This adds an `owner` relation to close that gap.
export const PERSON_OWNER_FIELD_ID = '71b82f08-6bb1-445a-a270-dd973c95c6a5';
export const PERSON_OWNER_REVERSE_FIELD_ID = '4304dd7a-fdc8-45e3-9d33-0185cd2d1a49';

// --- AI skill (native tool surface) ----------------------------------------
export const SKILL_ID = 'b1f81e5f-b5e1-456e-a8f0-cac41f467e8e';

// --- HTTP route paths (single source of truth; never hardcode "/s/") --------
export const ROUTE_GENERATE_SPEC = '/reports/generate-spec';
export const ROUTE_CREATE_REPORT = '/reports/create';
export const ROUTE_RUN_REPORT = '/reports/run';
export const ROUTE_ARRANGE_REPORT = '/reports/arrange';
export const ROUTE_LIST_OBJECTS = '/reports/data-sources';
export const ROUTE_LIST_SCOPE_FIELDS = '/reports/scope-fields';

// --- Enum-ish string constants shared by objects + logic --------------------
export const REPORT_FREQUENCY = {
  MANUAL: 'MANUAL',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const;

export const REPORT_VISIBILITY = {
  PRIVATE: 'PRIVATE',
  WORKSPACE: 'WORKSPACE',
} as const;

export const REPORT_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
} as const;

// Per-subscription scope: SELF = only the recipient's own rows; ALL = full report.
export const SUBSCRIPTION_SCOPE_MODE = {
  SELF: 'SELF',
  ALL: 'ALL',
} as const;

export const RUN_STATUS = {
  SUCCESS: 'SUCCESS',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;

export const RUN_TRIGGER = {
  SCHEDULED: 'SCHEDULED',
  MANUAL: 'MANUAL',
  PREVIEW: 'PREVIEW',
} as const;
