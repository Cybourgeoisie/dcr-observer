<?php

// Access the source gateway
require_once(dirname(realpath(__FILE__)) . '/../../server/gateway.php');

// Requests from the same server don't have a HTTP_ORIGIN header
if (!array_key_exists('HTTP_ORIGIN', $_SERVER))
{
	$_SERVER['HTTP_ORIGIN'] = $_SERVER['SERVER_NAME'];
}

try
{
	$api = new Api\RestApi($_REQUEST['request'], $_SERVER['HTTP_ORIGIN']);
	echo json_encode($api->processRequest());
}
catch (Exception $e)
{
	echo json_encode(array(
		'success' => false, 
		'error'   => $e->getMessage()
	));
}
