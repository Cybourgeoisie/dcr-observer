<?php

declare(strict_types=1);

namespace Service;

class Voting extends \Scrollio\Service\AbstractService
{
	public function getVotingResults(int $rci = 0)
	{
		// Validation - all time if invalid
		if ($rci <= 0) { $rci = 1; }

		// If we're showing all, omit the tx clause to speed things up
		if ($rci <= 0) {
			// Get the vote results for the given block period
			$sql = '
				SELECT
					tv.version,
					tv.votes,
					COUNT(tv.tx_vote_id) AS count
				FROM
					tx_vote tv
				GROUP BY
					tv.version, tv.votes;
			';
			$db_handler = \Geppetto\DatabaseHandler::init();
			$res = $db_handler->query($sql, array());
		} else {
			// Get the vote results for the given block period
			$sql = '
				SELECT
					tv.version,
					tv.votes,
					COUNT(tv.tx_vote_id) AS count
				FROM
					tx_vote tv
				JOIN
					tx ON tx.tx_id = tv.tx_id
				JOIN
					block ON block.block_id = tx.block_id AND block.height >= $1 AND block.height < $2
				GROUP BY
					tv.version, tv.votes;
			';
			$db_handler = \Geppetto\DatabaseHandler::init();
			$res = $db_handler->query($sql, array(($rci-1)*8064+4096, ($rci)*8064+4096));
		}

		if (empty($res) || !array_key_exists(0, $res)) {
			throw new \Exception('Could not collect voting results.');
		}

		return array(
			'results' => $this->formatVoteResults($res),
			'rci' => $rci,
			'block_start' => ($rci <= 0) ? 4096 : ($rci-1)*8064+4096,
			'block_end' => ($rci <= 0) ? 0 : $rci*8064+4096-1
		);
	}

	protected function formatVoteResults($res) {
		// Format the voting record
		$versions = array();
		$tickets_staked = 0;
		$vote_summary = array(
			'v0' => array('version' => 'V0', 'issue' => 'N/A', 'abstain' => 0, 'yes' => 0, 'no' => 0),
			'v1' => array('version' => 'V1', 'issue' => 'N/A', 'abstain' => 0, 'yes' => 0, 'no' => 0),
			'v2' => array('version' => 'V2', 'issue' => 'N/A', 'abstain' => 0, 'yes' => 0, 'no' => 0),
			'v3' => array('version' => 'V3', 'issue' => 'N/A', 'abstain' => 0, 'yes' => 0, 'no' => 0),
			'v4-sdiff' => array(
				'version' => 'V4', 'issue' => 'sdiffalgorithm', 'yes' => 0, 'no' => 0, 'abstain' => 0
			),
			'v4-lnsupport' => array(
				'version' => 'V4', 'issue' => 'lnsupport', 'yes' => 0, 'no' => 0, 'abstain' => 0
			),
			'v5-lnfeatures' => array(
				'version' => 'V5', 'issue' => 'lnfeatures', 'yes' => 0, 'no' => 0, 'abstain' => 0
			),
			'v6' => array('version' => 'V6', 'issue' => 'N/A', 'abstain' => 0, 'yes' => 0, 'no' => 0)
		);

		foreach ($res as $row) {
			$version = strval(intval($row['version']));

			if (!array_key_exists($version, $versions)) {
				$versions[$version] = 0;
			}

			$tickets_staked += $row['count'];
			$versions[$version] += $row['count'];

			switch($row['version']) {
				case '0000':
					$vote_summary['v0']['abstain'] += $row['count'];
					break;
				case '0001':
					$vote_summary['v1']['abstain'] += $row['count'];
					break;
				case '0002':
					$vote_summary['v2']['abstain'] += $row['count'];
					break;
				case '0003':
					$vote_summary['v3']['abstain'] += $row['count'];
					break;
				case '0004':
					$votes = intval($row['votes'], 16);

					if ($votes >> 1 & 0b10) {
						$vote_summary['v4-sdiff']['yes'] += $row['count'];
					} else if ($votes >> 1 & 0b01) {
						$vote_summary['v4-sdiff']['no'] += $row['count'];
					} else if (~($votes >> 1) & 0b11) {
						$vote_summary['v4-sdiff']['abstain'] += $row['count'];
					}

					if ($votes >> 3 & 0b10) {
						$vote_summary['v4-lnsupport']['yes'] += $row['count'];
					} else if ($votes >> 3 & 0b01) {
						$vote_summary['v4-lnsupport']['no'] += $row['count'];
					} else if (~($votes >> 3) & 0b11) {
						$vote_summary['v4-lnsupport']['abstain'] += $row['count'];
					}
					break;
				case '0005':
					$votes = intval($row['votes'], 16);

					if ($votes >> 1 & 0b10) {
						$vote_summary['v5-lnfeatures']['yes'] += $row['count'];
					} else if ($votes >> 1 & 0b01) {
						$vote_summary['v5-lnfeatures']['no'] += $row['count'];
					} else if (~($votes >> 1) & 0b11) {
						$vote_summary['v5-lnfeatures']['abstain'] += $row['count'];
					}
					break;
				case '0006':
					$vote_summary['v6']['abstain'] += $row['count'];
					break;
				default:
					break;
			}
		}

		return array(
			'versions' => $versions,
			'vote_summary' => $vote_summary,
			'tickets_staked' => $tickets_staked
		);
	}

	public function getIssueResults(string $issue, int $rci = 0)
	{
		// Validation - only known issues allowed
		$issues = array('lnsupport' => '0004', 'sdiffalgorithm' => '0004', 'lnfeatures' => '0005');
		if (!array_key_exists($issue, $issues)) {
			throw new \Exception('Issue not found.');
		}
		$version = $issues[$issue];

		// Validation - hmm
		if ($rci <= 0) { $rci = 1; }

		// Get the vote results for the given block period
		/*// Addresses
		$sql = '
			SELECT
				tv.votes,
				a.address,
				COUNT(tv.tx_vote_id) AS count
			FROM
				tx_vote tv
			JOIN
				tx_vote_address tva ON tva.tx_vote_id = tv.tx_vote_id
			JOIN
				address a ON a.address_id = tva.address_id
			JOIN
				tx ON tx.tx_id = tv.tx_id
			JOIN
				block ON block.block_id = tx.block_id AND block.height >= $2 AND block.height < $3
			WHERE
				tv.version = $1
			GROUP BY
				tv.votes, a.address
			ORDER BY
				3 DESC;
		';
		*/
		// wallets
		$sql = '
			SELECT
				tv.votes,
				primary_a.address,
				COUNT(tv.tx_vote_id) AS count
			FROM
				tx_vote tv
			JOIN
				tx_vote_address tva ON tva.tx_vote_id = tv.tx_vote_id
			JOIN
				address a ON a.address_id = tva.address_id
			JOIN
				address_network_view anv ON anv.address_id = a.address_id
			JOIN
				network_summary_view nsv ON nsv.network = anv.network
			JOIN
				address primary_a ON primary_a.address_id = nsv.primary_address_id
			JOIN
				tx ON tx.tx_id = tv.tx_id
			JOIN
				block ON block.block_id = tx.block_id AND block.height >= $2 AND block.height < $3
			WHERE
				tv.version = $1
			GROUP BY
				tv.votes, primary_a.address
			ORDER BY
				3 DESC;
		';

		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($version, ($rci-1)*8064+4096, ($rci)*8064+4096));

		if (empty($res) || !array_key_exists(0, $res)) {
			return array(
				'results' => array(
					'issue_summary' => array('abstain' => 0, 'yes' => 0, 'no' => 0, 'num_voters' => 0),
					'vote_summary' => array()
				),
				'empty' => true,
				'rci' => $rci,
				'block_start' => ($rci <= 0) ? 4096 : ($rci-1)*8064+4096,
				'block_end' => ($rci <= 0) ? 0 : $rci*8064+4096-1
			);
		}

		return array(
			'results' => $this->formatIssueResults($res, $issue),
			'rci' => $rci,
			'empty' => false,
			'block_start' => ($rci <= 0) ? 4096 : ($rci-1)*8064+4096,
			'block_end' => ($rci <= 0) ? 0 : $rci*8064+4096-1
		);
	}

	protected function formatIssueResults($res, $issue) {
		// Format the voting record
		$issue_summary = array('abstain' => 0, 'yes' => 0, 'no' => 0, 'num_voters' => 0);
		$vote_summary = array();

		foreach ($res as $row) {
			$votes = intval($row['votes'], 16);
			if ($issue == 'lnsupport') {
				$votes = $votes >> 3;
			} else {
				$votes = $votes >> 1;
			}

			$addr_votes = array('address' => $row['address'], 'abstain' => 0, 'yes' => 0, 'no' => 0);
			if ($votes & 0b10) {
				$addr_votes['yes']        += $row['count'];
				$issue_summary['yes']     += $row['count']; 
			} else if ($votes & 0b01) {
				$addr_votes['no']         += $row['count'];
				$issue_summary['no']      += $row['count']; 
			} else if (~($votes) & 0b11) {
				$addr_votes['abstain']    += $row['count'];
				$issue_summary['abstain'] += $row['count']; 
			}

			$vote_summary[] = $addr_votes;
			$issue_summary['num_voters']++;
		}

		return array(
			'issue_summary' => $issue_summary,
			'vote_summary' => $vote_summary
		);
	}

	public function getTopAddresses(int $start = 0, int $end = 0)
	{
		// Get the starting block
		$sql = '
			SELECT (dbs.last_block_id - 8064) AS start_block_id
			FROM database_blockchain_state dbs
			WHERE dbs.database_blockchain_state_id = 1;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array());

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('start_block_id', $res[0])) {
			throw new \Exception('Could not collect top ticket awardees.');
		}

		// Get the start_block_id
		$start_block_id = $res[0]['start_block_id'];

		// Get total & count of all addresses that voted
		$sql = '
			SELECT
				COUNT(tv.tx_vote_id) AS total,
				COUNT(DISTINCT tva.address_id) AS total_addresses
			FROM
				tx_vote_address tva
			JOIN
				tx_vote tv ON tv.tx_vote_id = tva.tx_vote_id
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > $1;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($start_block_id));

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('total_addresses', $res[0])) {
			throw new \Exception('Could not collect top ticket awardees.');
		}

		// Get the total_addresses
		$total = $res[0]['total'];
		$total_addresses = $res[0]['total_addresses'];

		$sql = '
			SELECT
				a.address,
				COUNT(tv.tx_vote_id) AS num
			FROM
				tx_vote_address tva
			JOIN
				tx_vote tv ON tv.tx_vote_id = tva.tx_vote_id
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > $1
			JOIN
				address a ON a.address_id = tva.address_id
			GROUP BY
				a.address_id
			ORDER BY
				2 DESC
			LIMIT
				200;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($start_block_id));

		if (empty($res) || !array_key_exists(0, $res)) {
			throw new \Exception('Could not collect top Decred addresses.');
		}

		return array(
			'total' => $total,
			'total_addresses' => $total_addresses,
			'top' => $res
		);
	}

	public function getTopNetworks(int $start = 0, int $end = 0)
	{
		// Get the starting block
		$sql = '
			SELECT (dbs.last_block_id - 8064) AS start_block_id
			FROM database_blockchain_state dbs
			WHERE dbs.database_blockchain_state_id = 1;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array());

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('start_block_id', $res[0])) {
			throw new \Exception('Could not collect top ticket awardees.');
		}

		// Get the start_block_id
		$start_block_id = $res[0]['start_block_id'];

		// Get count of all addresses that voted
		$sql = '
			SELECT
				COUNT(tv.tx_vote_id) AS total,
				COUNT(DISTINCT anv.network) AS total_networks
			FROM
				tx_vote tv
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > $1
			JOIN
				tx_vote_address tva ON tva.tx_vote_id = tv.tx_vote_id
			JOIN
				address a ON a.address_id = tva.address_id
			JOIN
				address_network_view anv ON anv.address_id = a.address_id;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($start_block_id));

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('total_networks', $res[0])) {
			throw new \Exception('Could not collect top ticket networks.');
		}

		// Get the total_networks
		$total = $res[0]['total'];
		$total_networks = $res[0]['total_networks'];

		$sql = '
			SELECT
				primary_address.address,
				COUNT(tv.tx_vote_id) AS num
			FROM
				tx_vote tv
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > $1
			JOIN
				tx_vote_address tva ON tva.tx_vote_id = tv.tx_vote_id
			JOIN
				address a ON a.address_id = tva.address_id
			JOIN
				address_network_view anv ON anv.address_id = tva.address_id
			JOIN
				address primary_address ON primary_address.address_id = anv.network
			GROUP BY
				anv.network,
				primary_address.address
			ORDER BY
				2 DESC
			LIMIT
				200;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($start_block_id));

		if (empty($res) || !array_key_exists(0, $res)) {
			throw new \Exception('Could not collect top Decred wallets.');
		}

		return array(
			'total' => $total,
			'total_networks' => $total_networks,
			'top' => $res
		);
	}

	public function getTopStakeAddresses(int $start = 0, int $end = 0)
	{
		// Get the starting block
		$sql = '
			SELECT (dbs.last_block_id - 8064) AS start_block_id
			FROM database_blockchain_state dbs
			WHERE dbs.database_blockchain_state_id = 1;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array());

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('start_block_id', $res[0])) {
			throw new \Exception('Could not collect top ticket awardees.');
		}

		// Get the start_block_id
		$start_block_id = $res[0]['start_block_id'];

		// Get count of all addresses that voted
		$sql = '
			SELECT
				COUNT(tv.tx_vote_id) AS total,
				COUNT(DISTINCT origin_ss_vout_address.address_id) AS total_addresses
			FROM
				tx_vote tv
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > $1
			JOIN
				vin ON vin.tx_id = tv.tx_id
			JOIN
				vout_address origin_ss_vout_address ON origin_ss_vout_address.vout_id = vin.vout_id;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($start_block_id));

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('total_addresses', $res[0])) {
			throw new \Exception('Could not collect top ticket awardees.');
		}

		// Get the total_addresses
		$total = $res[0]['total'];
		$total_addresses = $res[0]['total_addresses'];

		$sql = '
			SELECT
				a.address,
				COUNT(tv.tx_vote_id) AS num
			FROM
				tx_vote tv
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > $1
			JOIN
				vin ON vin.tx_id = tv.tx_id
			JOIN
				vout_address origin_ss_vout_address ON origin_ss_vout_address.vout_id = vin.vout_id
			JOIN
				address a ON a.address_id = origin_ss_vout_address.address_id
			GROUP BY
				a.address_id
			ORDER BY
				2 DESC
			LIMIT
				200;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($start_block_id));

		if (empty($res) || !array_key_exists(0, $res)) {
			throw new \Exception('Could not collect top ticket awardees.');
		}

		return array(
			'total' => $total,
			'total_addresses' => $total_addresses,
			'top' => $res
		);
	}
}
