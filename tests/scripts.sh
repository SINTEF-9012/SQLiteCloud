export PRIVATE_KEY=notasecret

curl -u curl:notasecret -X POST http://localhost:8080/exec -H 'Content-type: text/plain' -d @createTable.sql

curl -u curl:notasecret "http://localhost:8080/all?sql=SELECT%20*%20from%20tableTest"

curl -u curl:notasecret -X POST http://localhost:8080/get -H 'Content-type: text/plain' -d 'SELECT COUNT(*) FROM tableTest'

curl -u curl:notasecret -X POST http://localhost:8080/get -H 'Content-type: application/json' -d@tests/request.json