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
				a.identifier,
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

	public function getHdDetails(string $address) {
		// Validate the address
		$address = preg_replace("/[^A-Za-z0-9]/", '', $address);
		if (strlen($address) < 34 || strlen($address) > 36 || $address[0] != 'D')
		{
			throw new \Exception('Invalid address provided.');
		}

		$sql = '
			SELECT 
				a.address,
				a.identifier,
				CASE WHEN COALESCE(ba.balance, 0) < 0 THEN 0 ELSE COALESCE(ba.balance, 0) END AS balance,
				--tx.hash AS tx_hash,
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
			FROM (
				SELECT
					DISTINCT a.address_id
				FROM
					address a
				JOIN
					address a_this ON a_this.address = $1
				WHERE
					a_this.network = a.network
			) AS sq
			JOIN
				address a ON a.address_id = sq.address_id
			LEFT OUTER JOIN
				balance ba ON ba.address_id = a.address_id
			LEFT OUTER JOIN
				block bs ON bs.block_id = ba.first_block_id
			LEFT OUTER JOIN
				block be ON be.block_id = ba.last_block_id
			--JOIN
			--	tx ON tx.tx_id = sq.tx_id
			--WHERE
			--	balance > 0
			ORDER BY
				balance DESC NULLS LAST;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($address));

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('address', $res[0])) {
			$lone_address_info = self::getDetails($address);
			return array(
				'count' => 1,
				'addresses' => array($lone_address_info['addr_info'])
			);
		}

		return array(
			'count' => count($res),
			'addresses' => $res
		);
	}

	public function getImmediateNetwork(string $address) {
		// Validate the address
		$address = preg_replace("/[^A-Za-z0-9]/", '', $address);
		if (strlen($address) < 34 || strlen($address) > 36 || $address[0] != 'D')
		{
			throw new \Exception('Invalid address provided.');
		}

		$sql = '
			SELECT
				count
			FROM (
				SELECT
					COUNT(DISTINCT a.address_id) AS count
				FROM
					address a
				JOIN
					address a_this ON a_this.address = $1
				WHERE
					a_this.network = a.network
			) AS sq;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($address));

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('count', $res[0])) {
			return array(
				'network_size' => 1
			);
		}

		return array(
			'network_size' => $res[0]['count']
		);
	}

	public function getTop()
	{
		$sql = '
			SELECT
				a.address,
				a.identifier,
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

	public function getTopNetworks()
	{
		$sql = '
			SELECT
				hd.network,
				hd.balance,
				hd.rank,
				hd.num_addresses,
				a.address,
				a.identifier
			FROM
				hd_network hd
			JOIN
				address a ON a.address_id = hd.address_id
			GROUP BY
				hd.network, hd.balance, hd.rank, hd.num_addresses, a.address, a.identifier
			ORDER BY
				balance DESC
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

	public function getWealthNetworks()
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
				COUNT(*) AS num_wallets,
				SUM(balance) AS total_balance
			FROM
				hd_network
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
