<?php
declare(strict_types=1);

function envValue(string $key, string $default): string {
    $value = getenv($key);
    if ($value === false || $value === "") {
        return $default;
    }
    return $value;
}

define("APP_URL", envValue("GLITCHLET_APP_URL", "https://glitchlet.digitaldavidson.net/"));
define("APP_ORIGIN", envValue("GLITCHLET_APP_ORIGIN", "https://glitchlet.digitaldavidson.net"));
define("PROJECT_URL_BASE", APP_URL . "projects/");
define("PROJECTS_ROOT", envValue("GLITCHLET_PROJECTS_ROOT", __DIR__ . "/../projects"));
define("SESSION_COOKIE_NAME", envValue("GLITCHLET_SESSION_COOKIE", "glitchlet_session"));
define("BOOTSTRAP_TOKEN", envValue("GLITCHLET_BOOTSTRAP_TOKEN", "adc61011e2e82f2be4c97618c12bf229"));

define("DB_HOST", envValue("GLITCHLET_DB_HOST", "localhost"));
define("DB_PORT", envValue("GLITCHLET_DB_PORT", "3306"));
define("DB_NAME", envValue("GLITCHLET_DB_NAME", "digitald_glitchlet"));
define("DB_USER", envValue("GLITCHLET_DB_USER", "digitald_glitchlet"));
define("DB_PASS", envValue("GLITCHLET_DB_PASS", "HkU3PuNPo!QH2vU."));
