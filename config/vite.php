<?php

use craft\helpers\App;

return [
  'useDevServer' => App::env('ENVIRONMENT') === 'dev' || App::env('CRAFT_ENVIRONMENT') === 'dev',
  'devServerInternal' => 'http://localhost:3000',
  'devServerPublic' => 'https://crafty.ddev.site:3001',
  'serverPublic' => App::env('PRIMARY_SITE_URL') . 'static/dist/',
  'manifestPath' => '@webroot/static/dist/manifest.json',
  'errorEntry' => '',
  'cacheKeySuffix' => '',
  'includeReactRefreshShim' => false,
  'includeModulePreloadShim' => true,
];
