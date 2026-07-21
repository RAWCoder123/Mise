const baseChildVariables = [
  "PATH",
  "HOME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "SHELL",
  "USER",
  "LOGNAME",
  "LANG",
  "LC_ALL",
  "TERM",
  "CI",
  "NODE_EXTRA_CA_CERTS",
  "npm_config_cache",
  "XDG_CONFIG_HOME",
  "DOCKER_HOST",
  "CHROME_PATH",
  "MISE_ROUTE_SMOKE_PORT",
  "MISE_ROUTE_SMOKE_URL",
  "MISE_ROUTE_SMOKE_TIMEOUT_MS",
  "MISE_MOBILE_LAYOUT_PORT",
  "MISE_MOBILE_LAYOUT_DEBUG_PORT",
  "MISE_MOBILE_LAYOUT_URL",
  "MISE_MOBILE_LAYOUT_TIMEOUT_MS",
  "MISE_MOBILE_LAYOUT_WIDTH",
  "MISE_MOBILE_LAYOUT_HEIGHT",
  "MISE_MOBILE_LAYOUT_SCALE",
  "MISE_QA_INTERACTIONS",
  "MISE_QA_SCREENSHOT_PATH"
];

const trustedStagingVariables = [
  "SUPABASE_STAGING_URL",
  "SUPABASE_STAGING_ANON_KEY",
  "SUPABASE_STAGING_SECRET_KEY",
  "SUPABASE_STAGING_PROJECT_REF",
  "MISE_STAGING_MARKER",
  "MISE_STAGING_SEED_PASSWORD",
  "MISE_STAGING_CLIENT_RACE_URL",
  "MISE_STAGING_CLIENT_RACE_PORT",
  "MISE_STAGING_CLIENT_RACE_DEBUG_PORT",
  "MISE_STAGING_CLIENT_RACE_TIMEOUT_MS",
  "CHROME_PATH"
];

const forbiddenChildName = /(secret|password|service[_-]?role|private[_-]?key|access[_-]?token|refresh[_-]?token)/i;

function pick(source, names) {
  return Object.fromEntries(names.flatMap((name) => source[name] === undefined ? [] : [[name, source[name]]]));
}

export function minimalChildEnv(extra = {}, source = process.env) {
  const env = { ...pick(source, baseChildVariables), ...extra };
  for (const name of Object.keys(env)) {
    if (forbiddenChildName.test(name)) {
      throw new Error(`Refusing to pass trusted value ${name} to a QA subprocess.`);
    }
  }
  return env;
}

export function publicQaEnv(extra = {}, source = process.env) {
  return minimalChildEnv(extra, source);
}

export function trustedHostedChildEnv(extra = {}, source = process.env) {
  return {
    ...pick(source, [...baseChildVariables, ...trustedStagingVariables]),
    ...extra
  };
}

export function stagingChildEnv(variableNames, extra = {}, source = process.env) {
  return {
    ...pick(source, [...baseChildVariables, ...variableNames]),
    ...extra
  };
}
