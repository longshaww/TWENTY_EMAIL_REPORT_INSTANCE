import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APP_VAR_BREVO_SENDER_EMAIL_ID,
  APP_VAR_BREVO_SENDER_NAME_ID,
  APP_VAR_LLM_MODEL_ID,
  APP_VAR_PUBLIC_BASE_URL_ID,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  author: 'NorthPeak',
  category: 'Analytics',

  // Non-secret config with sensible defaults. These are readable server-side
  // (process.env) AND in front components (getApplicationVariable).
  applicationVariables: {
    // Single LLM gateway = OpenRouter (OpenAI-compatible). The MODEL is chosen
    // here so there is no hardcoded provider; submission default routes to Claude.
    LLM_MODEL: {
      universalIdentifier: APP_VAR_LLM_MODEL_ID,
      description:
        'OpenRouter model id used to build report specs and narratives (e.g. anthropic/claude-opus-4.8, openai/gpt-5.5).',
      value: 'anthropic/claude-opus-4.8',
      isSecret: false,
    },
    BREVO_SENDER_EMAIL: {
      universalIdentifier: APP_VAR_BREVO_SENDER_EMAIL_ID,
      // Brevo only sends from a verified sender. Set this to your verified Brevo
      // sender address (change it per deployment).
      description: 'From-address used for delivered report emails (must be a verified Brevo sender).',
      value: 'no-reply@example.com',
      isSecret: false,
    },
    BREVO_SENDER_NAME: {
      universalIdentifier: APP_VAR_BREVO_SENDER_NAME_ID,
      description: 'From-name shown on delivered report emails.',
      value: 'NorthPeak Reports',
      isSecret: false,
    },
    PUBLIC_BASE_URL: {
      universalIdentifier: APP_VAR_PUBLIC_BASE_URL_ID,
      description:
        'Base URL of the Twenty workspace UI, used to build "verify in Twenty" deep links inside emails. Set this to your workspace URL when self-hosting.',
      value: 'http://localhost:2020',
      isSecret: false,
    },
  },

  // Real secrets: never committed, entered once by a server admin in the app
  // settings UI, injected only into server-side logic functions.
  serverVariables: {
    OPENROUTER_API_KEY: {
      description: 'OpenRouter API key (https://openrouter.ai/keys). Used to call the configured LLM_MODEL.',
      isSecret: true,
      isRequired: true,
    },
    BREVO_API_KEY: {
      description: 'Brevo transactional email API key (https://app.brevo.com/settings/keys/api).',
      isSecret: true,
      isRequired: true,
    },
  },
});
