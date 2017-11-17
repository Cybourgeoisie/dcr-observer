<?php

declare(strict_types=1);

namespace Service;

class Address extends \Scrollio\Service\AbstractService
{
	public function getDetails(string $address)
	{
		// Validate the address
		$address = preg_replace("/[^A-Za-z0-9]/", '', $address);
		if (strlen($address) < 34 || strlen($address) > 36 || $address[0] != 'D')
		{
			throw new \Exception('Invalid address provided.');
		}

		$sql = '
			SELECT
				a.address,
				ba.rank,
				ba.balance,
				COALESCE(ba.tx, 0)    AS "tx",
				COALESCE(ba.stx, 0)   AS "stx",
				COALESCE(ba.vout, 0)  AS "vout",
				COALESCE(ba.vin, 0)   AS "vin",
				COALESCE(ba.svout, 0) AS "svout",
				COALESCE(ba.svin, 0)  AS "svin",
				EXTRACT(EPOCH FROM bs.time) AS "start",
				EXTRACT(EPOCH FROM be.time) AS "end",
				bs.height AS first,
				be.height AS last
			FROM
				address a
			JOIN
				balance ba ON ba.address_id = a.address_id
			JOIN
				block bs ON bs.block_id = ba.first_block_id
			JOIN
				block be ON be.block_id = ba.last_block_id
			WHERE
				a.address = $1;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($address));

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('address', $res[0])) {
			throw new \Exception('Could not find address.');
		}

		return array(
			'addr_info' => $res[0]
		);
	}

	public function getTop()
	{
		$sql = '
			SELECT
				a.address,
				b.balance,
				b.rank,
				COALESCE(b.tx, 0) AS tx,
				COALESCE(b.stx, 0) AS stx
			FROM
				balance b
			JOIN
				address a ON a.address_id = b.address_id
			ORDER BY
				b.rank ASC
			LIMIT
				500;
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

	public function getWealth()
	{
		$sql = '
			SELECT
				CASE
					WHEN balance < 1         THEN 0
					WHEN balance < 10        THEN 1
					WHEN balance < 100       THEN 2
					WHEN balance < 1000      THEN 3
					WHEN balance < 10000     THEN 4
					WHEN balance < 100000    THEN 5
					WHEN balance < 1000000   THEN 6
					WHEN balance < 10000000  THEN 7
					WHEN balance < 100000000 THEN 8
				ELSE 0 END AS bin,
				COUNT(*) AS num_addresses,
				SUM(balance) AS total_balance
			FROM
				balance
			WHERE
				balance > 0
			GROUP BY 1 ORDER BY 1 ASC;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array());

		if (empty($res) || !array_key_exists(0, $res)) {
			throw new \Exception('Could not collect Decred wealth by address.');
		}

		return array(
			'wealth' => $res
		);
	}
}
