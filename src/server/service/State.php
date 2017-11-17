<?php

declare(strict_types=1);

namespace Service;

class State extends \Scrollio\Service\AbstractService
{
	public function getInfo()
	{
		$sql = '
			SELECT
				dbs.total_dcr,
				b.height
			FROM
				database_blockchain_state dbs
			JOIN
				block b ON b.block_id = dbs.last_block_id;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array());

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('total_dcr', $res[0])) {
			throw new \Exception('Could not retrieve basic information.');
		}

		return array(
			'total_dcr' => $res[0]['total_dcr'],
			'height' => $res[0]['height']
		);
	}
}
