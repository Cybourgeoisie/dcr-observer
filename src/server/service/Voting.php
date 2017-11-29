<?php

declare(strict_types=1);

namespace Service;

class Voting extends \Scrollio\Service\AbstractService
{
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
				COUNT(DISTINCT a.network) AS total_networks
			FROM
				tx_vote tv
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > $1
			JOIN
				tx_vote_address tva ON tva.tx_vote_id = tv.tx_vote_id
			JOIN
				address a ON a.address_id = tva.address_id;
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
				hd_network hn ON hn.network = a.network
			JOIN
				address primary_address ON primary_address.address_id = hn.address_id
			GROUP BY
				hn.network,
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
