<?php

declare(strict_types=1);

namespace Service;

class Voting extends \Scrollio\Service\AbstractService
{
	public function getTopAddresses(int $start = 0, int $end = 0)
	{
		$sql = '
			SELECT
				DISTINCT a.address,
				COUNT(tv.*) AS num_votes
			FROM
				tx_vote tv
			JOIN
				vin ON vin.tx_id = tv.tx_id
			JOIN
				vout origin_ss_vout ON
					origin_ss_vout.vout_id = vin.vout_id AND 
					origin_ss_vout.type = \'stakesubmission\'
			JOIN
				vin origin_vin ON origin_vin.tx_id = origin_ss_vout.tx_id
			JOIN
				vout_address origin_vout_address ON origin_vout_address.vout_id = origin_vin.vout_id
			JOIN
				address a ON a.address_id = origin_vout_address.address_id
			GROUP BY
				a.address_id;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array());

		if (empty($res) || !array_key_exists(0, $res)) {
			throw new \Exception('Could not collect top Decred addresses.');
		}

		return array(
			'top' => $res
		);
	}
}
