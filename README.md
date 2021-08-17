# SOR API

HTTP endpoint for calling the Balancer SOR.

## Example Call

`$ curl -X POST -H "Content-Type: application/json" \
 -d '{"sellToken":"0xba100000625a3754423978a60c9317c58a424e3d","buyToken":"0x6b175474e89094c44da98b954eedeac495271d0f","orderKind":"sell", "amount":"1000000000000000000", "gasPrice":"10000000"}' \
http://localhost:8889`


Based on https://github.com/nlordell/gp-v2-balzor
