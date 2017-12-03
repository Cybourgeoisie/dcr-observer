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
				EXTRACT(EPOCH FROM bs.time) AS "start",
				EXTRACT(EPOCH FROM be.time) AS "end",
				bs.height AS first,
				be.height AS last,
				COALESCE(ba.liquid_balance, 0) AS liquid,
				COALESCE(ba.stakesubmission_balance, 0) AS active_stake_submissions
			FROM
				address a
			JOIN
				address_summary_view ba ON ba.address_id = a.address_id
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

		$voting_info = $this->getAddressVotingRecord($address);

		return array(
			'addr_info'      => $res[0],
			'voting_record'  => $voting_info['voting_record'],
			'voting_tally'   => $voting_info['voting_tally'],
			'tickets_staked' => $voting_info['tickets_staked']
		);
	}

	public function getAddressVotingRecord(string $address)
	{
		// Validate the address
		$address = preg_replace("/[^A-Za-z0-9]/", '', $address);
		if (strlen($address) < 34 || strlen($address) > 36 || $address[0] != 'D')
		{
			throw new \Exception('Invalid address provided.');
		}

		$sql = '
			SELECT
				tv.version,
				tv.votes,
				COUNT(tv.tx_vote_id) AS count
			FROM
				address a
			JOIN
				tx_vote_address tva ON tva.address_id = a.address_id
			JOIN
				tx_vote tv ON tv.tx_vote_id = tva.tx_vote_id
			WHERE
				a.address = $1
			GROUP BY
				tv.version, tv.votes;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($address));

		return $this->formatTickets($address, $res);
	}

	public function getWalletVotingRecord(string $address)
	{
		// Validate the address
		$address = preg_replace("/[^A-Za-z0-9]/", '', $address);
		if (strlen($address) < 34 || strlen($address) > 36 || $address[0] != 'D')
		{
			throw new \Exception('Invalid address provided.');
		}

		$sql = '
			SELECT
				tv.version,
				tv.votes,
				COUNT(tv.tx_vote_id) AS count
			FROM
				address a
			JOIN
				address_network_view anv ON anv.address_id = a.address_id
			JOIN
				address_network_view anv_network ON anv_network.network = anv.network
			JOIN
				address a_network ON a_network.address_id = anv_network.address_id
			JOIN
				tx_vote_address tva ON tva.address_id = a_network.address_id
			JOIN
				tx_vote tv ON tv.tx_vote_id = tva.tx_vote_id
			WHERE
				a.address = $1
			GROUP BY
				tv.version, tv.votes;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($address));

		return $this->formatTickets($address, $res);
	}

	protected function formatTickets($address, $res) {
		// Format the voting record
		$tickets_staked = 0;
		$voting_tally = array('v4' => 0, 'v5' => 0, 'all' => 0);
		$voting_record = array(
			'v4-sdiff' => array(
				'version' => 'V4', 'issue' => 'sdiffalgorithm', 'yes' => 0, 'no' => 0, 'abstain' => 0
			),
			'v4-lnsupport' => array(
				'version' => 'V4', 'issue' => 'lnsupport', 'yes' => 0, 'no' => 0, 'abstain' => 0
			),
			'v5-lnfeatures' => array(
				'version' => 'V5', 'issue' => 'lnfeatures', 'yes' => 0, 'no' => 0, 'abstain' => 0
			)
		);

		foreach ($res as $row) {
			$tickets_staked += $row['count'];
			switch($row['version']) {
				case '0004':
					$voting_tally['all'] += $row['count'];
					$voting_tally['v4'] += $row['count'];
					switch($row['votes']) {
						case '01':
							$voting_record['v4-sdiff']['abstain'] += $row['count'];
							$voting_record['v4-lnsupport']['abstain'] += $row['count'];
							break;
						case '03':
							$voting_record['v4-sdiff']['no'] += $row['count'];
							$voting_record['v4-lnsupport']['abstain'] += $row['count'];
							break;
						case '05':
							$voting_record['v4-sdiff']['yes'] += $row['count'];
							$voting_record['v4-lnsupport']['abstain'] += $row['count'];
							break;
						case '11':
							$voting_record['v4-sdiff']['abstain'] += $row['count'];
							$voting_record['v4-lnsupport']['yes'] += $row['count'];
							break;
						case '15':
							$voting_record['v4-sdiff']['yes'] += $row['count'];
							$voting_record['v4-lnsupport']['yes'] += $row['count'];
							break;
						default:
							break;
					}
				break;
				case '0005':
					$voting_tally['all'] += $row['count'];
					$voting_tally['v5'] += $row['count'];
					switch($row['votes']) {
						case '01':
							$voting_record['v5-lnfeatures']['abstain'] += $row['count'];
							break;
						case '03':
							$voting_record['v5-lnfeatures']['no'] += $row['count'];
							break;
						case '05':
							$voting_record['v5-lnfeatures']['yes'] += $row['count'];
							break;
						default:
							break;
					}
				break;
				default:
				break;
			}
		}

		return array(
			'address' => $address,
			'voting_record' => $voting_record,
			'voting_tally' => $voting_tally,
			'tickets_staked' => $tickets_staked
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
				asv.vout,
				avbv.genesis,
				avbv.coinbase,
				avbv.stakebase,
				avbv.stakesubmission,
				avbv.direct_from_exchange
			FROM
				address_summary_view asv
			JOIN
				address_vout_breakdown_view avbv ON avbv.address_id = asv.address_id
			JOIN
				address a ON a.address_id = asv.address_id
			WHERE
				a.address = $1
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

		// Get the network details first
		$sql = '
			SELECT 
				a.address,
				a.identifier,
				CASE WHEN COALESCE(nsv.balance, 0) < 0 THEN 0 ELSE COALESCE(nsv.balance, 0) END AS balance,
				--tx.hash AS tx_hash,
				COALESCE(nsv.tx, 0)    AS "tx",
				COALESCE(nsv.stx, 0)   AS "stx",
				COALESCE(nsv.vout, 0)  AS "vout",
				COALESCE(nsv.vin, 0)   AS "vin",
				EXTRACT(EPOCH FROM bs.time) AS "start",
				EXTRACT(EPOCH FROM be.time) AS "end",
				bs.height AS first,
				be.height AS last,
				nsv.num_addresses
			FROM
				address a
			JOIN
				address_network_view anv ON anv.address_id = a.address_id
			JOIN
				network_summary_view nsv ON nsv.network = anv.network
			LEFT OUTER JOIN
				block bs ON bs.block_id = nsv.first_block_id
			LEFT OUTER JOIN
				block be ON be.block_id = nsv.last_block_id
			WHERE
				a.address = $1;
		';

		$db_handler = \Geppetto\DatabaseHandler::init();
		$res_network = $db_handler->query($sql, array($address));

		if (empty($res_network) || !array_key_exists(0, $res_network) || !array_key_exists('address', $res_network[0])) {
			throw new \Exception('Could not find HD wallet by address.');
		}

		// Get all the address details after
		$sql = '
			SELECT 
				a.address,
				a.identifier,
				CASE WHEN COALESCE(asv.balance, 0) < 0 THEN 0 ELSE COALESCE(asv.balance, 0) END AS balance,
				--tx.hash AS tx_hash,
				COALESCE(asv.tx, 0)    AS "tx",
				COALESCE(asv.stx, 0)   AS "stx",
				COALESCE(asv.vout, 0)  AS "vout",
				COALESCE(asv.vin, 0)   AS "vin",
				EXTRACT(EPOCH FROM bs.time) AS "start",
				EXTRACT(EPOCH FROM be.time) AS "end",
				bs.height AS first,
				be.height AS last
			FROM
				address a_this
			JOIN
				address_network_view anv_this ON anv_this.address_id = a_this.address_id
			JOIN
				address_network_view anv ON anv.network = anv_this.network
			JOIN
				address_summary_view asv ON asv.address_id = anv.address_id
			JOIN
				address a ON a.address_id = asv.address_id
			LEFT OUTER JOIN
				block bs ON bs.block_id = asv.first_block_id
			LEFT OUTER JOIN
				block be ON be.block_id = asv.last_block_id
			WHERE
				a_this.address = $1
			ORDER BY
				asv.balance DESC NULLS LAST
			LIMIT
				250;
		';

		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($address));

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('address', $res[0])) {
			$lone_address_info = self::getDetails($address);
			return array(
				'count'     => 1,
				'network'   => $res_network[0],
				'addresses' => array($lone_address_info['addr_info'])
			);
		}

		$voting_info = $this->getWalletVotingRecord($address);

		return array(
			'count'          => $res_network[0]['num_addresses'],
			'network'        => $res_network[0],
			'addresses'      => $res,
			'voting_record'  => $voting_info['voting_record'],
			'voting_tally'   => $voting_info['voting_tally'],
			'tickets_staked' => $voting_info['tickets_staked']
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
				SUM(COALESCE(asv_other.vout, 0)) AS vout,
				SUM(COALESCE(avbv.genesis, 0)) AS genesis,
				SUM(COALESCE(avbv.coinbase, 0)) AS coinbase,
				SUM(COALESCE(avbv.stakebase, 0)) AS stakebase,
				SUM(COALESCE(avbv.stakesubmission, 0)) AS stakesubmission,
				SUM(COALESCE(avbv.direct_from_exchange, 0)) AS direct_from_exchange
			FROM
				address a
			JOIN
				address_network_view anv ON anv.address_id = a.address_id
			JOIN
				network_summary_view nsv ON nsv.network = anv.network
			JOIN
				address_network_view anv_other ON anv_other.network = anv.network
			JOIN
				address_summary_view asv_other ON asv_other.address_id = anv_other.address_id
			JOIN
				address_vout_breakdown_view avbv ON avbv.address_id = anv_other.address_id
			WHERE
				a.address = $1
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
				asv.balance AS value
			FROM
				address a_this
			JOIN
				address_network_view anv_this ON anv_this.address_id = a_this.address_id
			JOIN
				address_network_view anv ON anv.network = anv_this.network
			JOIN
				address_summary_view asv ON asv.address_id = anv.address_id
			JOIN
				address a ON a.address_id = asv.address_id
			WHERE
				asv.balance > 0 AND a_this.address = $1
			ORDER BY
				asv.balance DESC;
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
				nsv.num_addresses
			FROM 
				address a
			JOIN
				address_network_view anv ON anv.address_id = a.address_id
			JOIN
				network_summary_view nsv ON nsv.network = anv.network
			WHERE
				a.address = $1;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($address));

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('num_addresses', $res[0])) {
			return array(
				'network_size' => 1
			);
		}

		return array(
			'network_size' => $res[0]['num_addresses']
		);
	}

	public function getTop()
	{
		$sql = '
			SELECT
				asv.rank,
				asv.actively_staking,
				a.address,
				a.identifier,
				asv.balance,
				COALESCE(asv.tx, 0) AS tx,
				COALESCE(asv.stx, 0) AS stx
			FROM
				address_summary_view asv
			JOIN
				address a ON a.address_id = asv.address_id
			ORDER BY
				asv.rank ASC
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
				--hd_network hd
				network_summary_view hd
			JOIN
				--address a ON a.address_id = hd.address_id
				address a ON a.address_id = hd.primary_address_id
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
				address_balance_view b
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
				address_balance_view b
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
				address_balance_view
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
				--hd_network hd
				network_summary_view hd
			JOIN
				--address a ON a.address_id = hd.address_id
				address a ON a.address_id = hd.network
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
				--hd_network
				network_summary_view hd
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
				--hd_network
				network_balance_view
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
