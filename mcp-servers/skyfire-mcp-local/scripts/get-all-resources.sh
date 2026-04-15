API_KEY=${1?please provide api key}
curl -v -X POST localhost:4000/mcp -d '{"jsonrpc": "2.0", "id": "101", "method": "resources/list", "params": {"protocolVersion": "123", "capabilities": {}, "clientInfo": {"name": "curl", "version": "123"}}}' -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "Mcp-session-id: $(bash get-session-id.sh $API_KEY )"
