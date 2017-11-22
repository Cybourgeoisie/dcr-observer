<?php

/** ENVIRONMENT **/

// To be used to distinguish between dev, staging, prod in one file and fewer docker crap
define('PROGRAM_ENVIRONMENT', getenv('PROGRAM_ENVIRONMENT'));

switch (PROGRAM_ENVIRONMENT)
{
	// Development
	case 'DEVELOPMENT':
		// Dev only - print all errors
		error_reporting(E_ALL);
		ini_set('display_errors', '1');

		// Site address
		define('SITE_ADDRESS', 'http://192.168.99.100/');

		break;

	case 'PRODUCTION':
		// Tell no secrets
		error_reporting(0);
		ini_set('display_errors', '0');

		// Site address
		define('SITE_ADDRESS', 'https://www.dcr.observer');

		break;

	// Just die.
	default:
		die('Unauthorized Access.');
		break;
}

/** STANDARD **/

// Database Connection
define('DB_HOST', getenv('DCRAUDIT_DB_HOST'));
define('DB_PORT', 5432);
define('DB_NAME', getenv('DCRAUDIT_DB_NAME'));
define('DB_USER', getenv('DCRAUDIT_DB_USER'));
define('DB_PASS', getenv('DCRAUDIT_DB_PASS'));

// Scrollio: CORS
define('SCROLLIO_WEBSITE_ORIGINS', SITE_ADDRESS);
define('SCROLLIO_WEBSITE_ORIGINS_ACCEPT_ALL', false);

// Paths
define('ROOT_PATH', dirname(realpath(__FILE__)) . '/../');
define('APP_PATH',  ROOT_PATH . 'app/');
define('SERVER_PATH',  ROOT_PATH . 'server/');

// Common Files
define('GATEWAY_PATH', SERVER_PATH . 'gateway.php');

// Site Configuration
define('API_ADDRESS', SITE_ADDRESS . 'api/');

// Site Meta
define('SITE_NAME', 'Decred Observer');
define('SITE_ADDRESS_CLEAN', 'www.dcr.observer');

// Security
define('PASSWORD_SALT', 'The proof-of-work difficulty as a multiple of the minimum difficulty');
