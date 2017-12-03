<?php

namespace Api;

class RestApi extends \Scrollio\Api\AbstractApi
{
	protected $endpoint_namespace = 'Service\\';

	public function __construct($request, $origin)
	{
		parent::__construct($request);
	}

	public function processRequest()
	{
		// Check for cache file
		if (defined('USE_CACHING') && USE_CACHING) {
			$cached_data = $this->getCacheFile();
			if ($cached_data) {
				return $cached_data;
			}
		}

		// Get live results
		$result = parent::processRequest();

		// Cache the result
		if (defined('USE_CACHING') && USE_CACHING) {
			$this->createCacheFile($result);
		}

		// Return the result
		return $result;
	}

	protected function getCacheFile() {
		// Form the cache filename
		$filename = $this->formCacheFilename();

		// If we find the cache, then return it
		if (file_exists($filename)) {
			try {
				$json_contents = \file_get_contents($filename);
				$contents = \json_decode($json_contents, true);
				return $contents;
			} catch (\Exception $ex) {
				// Require that we retrieve new data
				return false;
			}
		}

		// Require that we retrieve new data
		return false;
	}

	protected function createCacheFile($contents) {
		// Form the cache filename
		$filename = $this->formCacheFilename();

		// Format the cache results
		$json_contents = json_encode($contents);

		// Save the file
		$cached = fopen($filename, 'w');
		fwrite($cached, $json_contents);
		fclose($cached);
	}

	protected function formCacheFilename() {
		// Set the filename and exact location
		$filename  = CACHE_PATH . $this->endpoint_class . '_' . $this->endpoint_method . '_';
		$filename .= preg_replace('/[^a-zA-Z0-9]/', '_', json_encode($this->args)) . '.cache';
		return $filename;
	}
}
