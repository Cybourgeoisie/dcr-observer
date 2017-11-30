for (var i = 3000000; i < 12449225; i += 200000) {
	var string = "UPDATE vout SET address_id = sq.address_id FROM (SELECT vout_id, address_id FROM ";
	string += "vout_address WHERE vout_id >= " + i + " AND vout_id < " + (i + 200000);
	string += ") AS sq WHERE vout.vout_id = sq.vout_id;";
	console.log(string);
}

UPDATE vout SET address_id = sq.address_id FROM (SELECT vout_id, address_id FROM vout_address 
WHERE vout_id >= 12449224 AND vout_id < 12600000) AS sq WHERE vout.vout_id = sq.vout_id;
