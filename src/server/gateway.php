<?php

/**
 * Program Gateway - kickstart the program
 */

// Include the vendor autoloader
require_once(__DIR__ . '/../vendor/autoload.php');

// Include the config to get us started
require_once(dirname(realpath(__FILE__)) . '/../config/config.php');

// For now, just require certain files directly
require_once(SERVER_PATH . 'api/RestApi.php');
