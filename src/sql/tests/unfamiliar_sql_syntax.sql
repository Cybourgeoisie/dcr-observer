CREATE TABLE "foo" (
	"foo_id" BIGSERIAL PRIMARY KEY,
	"type" TEXT
);


CREATE TABLE "bar" (
	"bar_id" BIGSERIAL PRIMARY KEY,
	"foo_id" BIGINT REFERENCES "foo" (foo_id),
	"description" TEXT
);

WITH ins (description, type) AS
( VALUES
    ( 'more testing',   'blue') ,
    ( 'yet another row', 'green' )
)  
INSERT INTO bar
   (description, foo_id) 
SELECT 
    ins.description, foo.foo_id
FROM 
  foo JOIN ins
    ON ins.type = foo.type ;
