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
				be.height AS last,
				COALESCE(ba.liquid, 0) AS liquid,
				COALESCE(ba.active_stake_submissions, 0) AS active_stake_submissions
				--(
				--	SELECT COALESCE(SUM(vout_stxsub.value), 0) FROM address a 
				--	JOIN vout_address va ON va.address_id = a.address_id 
				--	JOIN vout vout_stxcmt ON 
				--		vout_stxcmt.vout_id = va.vout_id AND 
				--		vout_stxcmt.type = \'sstxcommitment\' 
				--	JOIN tx ON tx.tx_id = vout_stxcmt.tx_id AND tx.tree = 1 
				--	JOIN vin ON vin.tx_id = tx.tx_id
				--	JOIN vout_address vin_va ON
				--		vin_va.vout_id = vin.vout_id AND 
				--		vin_va.address_id = a.address_id
				--	JOIN vout vout_stxsub ON 
				--		vout_stxsub.tx_id = tx.tx_id AND 
				--		vout_stxsub.type = \'stakesubmission\' 
				--	JOIN vout_address va_stxsub ON 
				--		va_stxsub.vout_id = vout_stxsub.vout_id AND 
				--		va_stxsub.address_id != a.address_id
				--	LEFT JOIN vin vin_spent ON 
				--		vin_spent.vout_id = vout_stxsub.vout_id
				--	WHERE a.address = $1 AND vin_spent.vin_id IS NULL 
				--) AS actively_staking, -- vin & sstxcommitment have same address, stakesubmission is diff
				--(
				--	SELECT COALESCE(SUM(vout_stxsub.value), 0) FROM address a 
				--	JOIN vout_address va ON va.address_id = a.address_id 
				--	JOIN vout vout_stxcmt ON 
				--		vout_stxcmt.vout_id = va.vout_id AND 
				--		vout_stxcmt.type = \'sstxcommitment\' 
				--	JOIN tx ON tx.tx_id = vout_stxcmt.tx_id AND tx.tree = 1 
				--	JOIN vout vout_stxsub ON 
				--		vout_stxsub.tx_id = tx.tx_id AND 
				--		vout_stxsub.type = \'stakesubmission\' 
				--	JOIN vout_address va_stxsub ON 
				--		va_stxsub.vout_id = vout_stxsub.vout_id AND 
				--		va_stxsub.address_id != a.address_id
				--	LEFT JOIN vin vin_spent ON 
				--		vin_spent.vout_id = vout_stxsub.vout_id
				--	WHERE a.address = $1 AND vin_spent.vin_id IS NULL 
				--) AS actively_staking, -- sstxcommitment is current address, stakesubmission is diff
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

	public function getVoutDetails(string $address)
	{
		// Validate the address
		$address = preg_replace("/[^A-Za-z0-9]/", '', $address);
		if (strlen($address) < 34 || strlen($address) > 36 || $address[0] != 'D')
		{
			throw new \Exception('Invalid address provided.');
		}

		$sql = '
			SELECT
			-- All TX inputs
			(SELECT b.vout
			FROM balance b 
			JOIN address a ON a.address_id = b.address_id
			WHERE a.address = $1) AS vout,
			-- All coinbase inputs (mining), except the genesis block
			(SELECT COALESCE(SUM(vout.value), 0) 
			FROM address a 
			JOIN vout_address va ON va.address_id = a.address_id 
			JOIN vout ON vout.vout_id = va.vout_id 
			JOIN tx ON tx.tx_id = vout.tx_id AND tx.tree = 0 AND tx.tx_id != 1 
			JOIN vin ON vin.tx_id = tx.tx_id AND vin.coinbase != \'\'
			WHERE a.address = $1) AS coinbase,
			-- All stakegen inputs
			(SELECT COALESCE(SUM(vout.value), 0)
			FROM address a 
			JOIN vout_address va ON va.address_id = a.address_id 
			JOIN vout ON vout.vout_id = va.vout_id AND vout.type = \'stakegen\'
			WHERE a.address = $1) AS stakebase,
			-- All stakesubmission inputs
			(SELECT COALESCE(SUM(vout.value), 0)
			FROM address a 
			JOIN vout_address va ON va.address_id = a.address_id 
			JOIN vout ON vout.vout_id = va.vout_id AND vout.type = \'stakesubmission\'
			WHERE a.address = $1) AS stakesubmission,
			-- All genesis inputs
			(SELECT COALESCE(SUM(vout.value), 0)
			FROM address a 
			JOIN vout_address va ON va.address_id = a.address_id 
			JOIN vout ON vout.vout_id = va.vout_id AND vout.tx_id = 1
			WHERE a.address = $1) AS genesis,
			-- All inputs from an exchange
			(SELECT COALESCE(SUM(vout.value), 0)
			FROM address a 
			JOIN vout_address va ON va.address_id = a.address_id 
			JOIN vout ON vout.vout_id = va.vout_id 
			JOIN vin ON vin.tx_id = vout.tx_id 
			JOIN vout_address origin_vout_address ON origin_vout_address.vout_id = vin.vout_id
			JOIN address origin_address ON 
				origin_address.address_id = origin_vout_address.address_id AND 
				origin_address.identifier IN (\'Poloniex\', \'Bittrex\')
			WHERE a.address = $1 AND a.identifier NOT IN (\'Poloniex\', \'Bittrex\')) AS direct_from_exchange
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($address));

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('vout', $res[0])) {
			throw new \Exception('Could not find address.');
		}

		// Get the total vouts & subtract all of the known items
		$vout_remaining = floatval($res[0]['vout']) - (floatval($res[0]['coinbase']) + 
				floatval($res[0]['stakebase']) + floatval($res[0]['stakesubmission']) +
				floatval($res[0]['genesis']) + floatval($res[0]['direct_from_exchange']));

		// Format properly
		$data = array(
			array('label' => 'Transactions', 'value' => $vout_remaining),
			array('label' => 'Genesis', 'value' => $res[0]['genesis']),
			array('label' => 'Mining', 'value' => $res[0]['coinbase']),
			array('label' => 'Exchange', 'value' => $res[0]['direct_from_exchange']),
			array('label' => 'Staking', 'value' => $res[0]['stakebase']),
			array('label' => 'Stake Submissions', 'value' => $res[0]['stakesubmission'])
		);

		return array(
			'data' => $data
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

	public function getHdVoutDetails(string $address)
	{
		// Validate the address
		$address = preg_replace("/[^A-Za-z0-9]/", '', $address);
		if (strlen($address) < 34 || strlen($address) > 36 || $address[0] != 'D')
		{
			throw new \Exception('Invalid address provided.');
		}

		$sql = '
			SELECT
			-- All TX inputs
			(SELECT SUM(b.vout)
			FROM balance b 
			JOIN address a ON a.address_id = b.address_id
			JOIN address this ON this.address = $1
			WHERE this.network = a.network) AS vout,
			-- All coinbase inputs (mining), except the genesis block
			(SELECT COALESCE(SUM(vout.value), 0) 
			FROM address a 
			JOIN address this ON this.address = $1
			JOIN vout_address va ON va.address_id = a.address_id 
			JOIN vout ON vout.vout_id = va.vout_id 
			JOIN tx ON tx.tx_id = vout.tx_id AND tx.tree = 0 AND tx.tx_id != 1 
			JOIN vin ON vin.tx_id = tx.tx_id AND vin.coinbase != \'\'
			WHERE a.network = this.network) AS coinbase,
			-- All stakegen inputs
			(SELECT COALESCE(SUM(vout.value), 0)
			FROM address a 
			JOIN address this ON this.address = $1
			JOIN vout_address va ON va.address_id = a.address_id 
			JOIN vout ON vout.vout_id = va.vout_id AND vout.type = \'stakegen\'
			WHERE a.network = this.network) AS stakebase,
			-- All stakesubmission inputs
			(SELECT COALESCE(SUM(vout.value), 0)
			FROM address a 
			JOIN address this ON this.address = $1
			JOIN vout_address va ON va.address_id = a.address_id 
			JOIN vout ON vout.vout_id = va.vout_id AND vout.type = \'stakesubmission\'
			WHERE a.network = this.network) AS stakesubmission,
			-- All genesis inputs
			(SELECT COALESCE(SUM(vout.value), 0)
			FROM address a 
			JOIN address this ON this.address = $1
			JOIN vout_address va ON va.address_id = a.address_id 
			JOIN vout ON vout.vout_id = va.vout_id AND vout.tx_id = 1
			WHERE a.network = this.network) AS genesis,
			-- All inputs from an exchange
			(SELECT COALESCE(SUM(vout.value), 0)
			FROM address a 
			JOIN address this ON this.address = $1
			JOIN vout_address va ON va.address_id = a.address_id 
			JOIN vout ON vout.vout_id = va.vout_id 
			JOIN vin ON vin.tx_id = vout.tx_id 
			JOIN vout_address origin_vout_address ON origin_vout_address.vout_id = vin.vout_id
			JOIN address origin_address ON 
				origin_address.address_id = origin_vout_address.address_id AND 
				origin_address.identifier IN (\'Poloniex\', \'Bittrex\')
			WHERE a.network = this.network AND a.identifier NOT IN (\'Poloniex\', \'Bittrex\')) AS direct_from_exchange
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($address));

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('vout', $res[0])) {
			throw new \Exception('Could not find address.');
		}

		// Get the total vouts & subtract all of the known items
		$vout_remaining = floatval($res[0]['vout']) - (floatval($res[0]['coinbase']) + 
				floatval($res[0]['stakebase']) + floatval($res[0]['stakesubmission']) +
				floatval($res[0]['genesis']) + floatval($res[0]['direct_from_exchange']));

		// Format properly
		$data = array(
			array('label' => 'Transactions', 'value' => $vout_remaining),
			array('label' => 'Genesis', 'value' => $res[0]['genesis']),
			array('label' => 'Mining', 'value' => $res[0]['coinbase']),
			array('label' => 'Exchange', 'value' => $res[0]['direct_from_exchange']),
			array('label' => 'Staking', 'value' => $res[0]['stakebase']),
			array('label' => 'Stake Submissions', 'value' => $res[0]['stakesubmission'])
		);

		return array(
			'data' => $data
		);
	}

	public function getHdChartBreakdown(string $address) {
		// Validate the address
		$address = preg_replace("/[^A-Za-z0-9]/", '', $address);
		if (strlen($address) < 34 || strlen($address) > 36 || $address[0] != 'D')
		{
			throw new \Exception('Invalid address provided.');
		}

		$sql = '
			SELECT 
				a.address AS label,
				ba.balance AS value
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
			JOIN
				balance ba ON ba.address_id = a.address_id
			WHERE
				balance > 0
			ORDER BY
				balance DESC;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($address));

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('value', $res[0])) {
			throw new \Exception('Could not find breakdown for address');
		}

		return array(
			'data' => $res
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
			ORDER BY
				rank ASC
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

	public function getWealthAddressesBetweenRanges(float $range_start, float $range_end)
	{
		// We do not let the site slow down
		if ($range_start <= 0) {
			$range_start = 0.01;
		}

		$bin = number_format($range_start) . ' to ' . number_format($range_end) . ' DCR';

		$sql = '
			SELECT
				CASE WHEN a.identifier != \'\' THEN a.identifier ELSE a.address END AS label,
				b.balance AS value
			FROM
				balance b
			JOIN
				address a ON a.address_id = b.address_id
			WHERE
				b.balance >= $1 AND b.balance < $2
			ORDER BY balance DESC
			LIMIT 70;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($range_start, $range_end));

		if (empty($res) || !array_key_exists(0, $res)) {
			throw new \Exception('Could not collect Decred wealth by address.');
		}

		$sql = '
			SELECT
				SUM(balance) AS value
			FROM
				balance
			WHERE
				balance >= $1 AND balance <= $2
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res_other = $db_handler->query($sql, array($range_start, $range_end));
		if (!empty($res_other) && array_key_exists('0', $res_other)) {
			// Now subtract the total value of the aforementioned from this balance
			$total = 0;
			foreach ($res as $row) {
				$total += $row['value'];
			}
					
			$res_other[0]['value'] -= $total;
			$res_other[0]['label'] = 'Other';

			if ($res_other[0]['value'] >= 1) {
				$res[] = $res_other[0];
			}
		}

		return array(
			'data' => $res,
			'bin' => $bin
		);
	}

	public function getWealthNetworksBetweenRanges(float $range_start, float $range_end)
	{
		// We do not let the site slow down
		if ($range_start <= 0) {
			$range_start = 0.01;
		}

		$bin = number_format($range_start) . ' to ' . number_format($range_end) . ' DCR';

		$sql = '
			SELECT
				CASE WHEN a.identifier != \'\' THEN a.identifier ELSE a.address END AS label,
				hd.balance AS value
			FROM
				hd_network hd
			JOIN
				address a ON a.address_id = hd.address_id
			WHERE
				hd.balance >= $1 AND hd.balance < $2
			ORDER BY hd.balance DESC
			LIMIT 70;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($range_start, $range_end));

		if (empty($res) || !array_key_exists(0, $res)) {
			throw new \Exception('Could not collect Decred wealth by address.');
		}

		$sql = '
			SELECT
				SUM(balance) AS value
			FROM
				hd_network
			WHERE
				balance >= $1 AND balance <= $2
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res_other = $db_handler->query($sql, array($range_start, $range_end));
		if (!empty($res_other) && array_key_exists('0', $res_other)) {
			// Now subtract the total value of the aforementioned from this balance
			$total = 0;
			foreach ($res as $row) {
				$total += $row['value'];
			}
					
			$res_other[0]['value'] -= $total;
			$res_other[0]['label'] = 'Other';

			if ($res_other[0]['value'] >= 1) {
				$res[] = $res_other[0];
			}
		}

		return array(
			'data' => $res,
			'bin' => $bin
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
