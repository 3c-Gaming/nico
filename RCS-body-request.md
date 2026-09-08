Body Request

```json
{
  "from": "6a95c33e6c0c05834f188cb5",
  "to": "5531994445728",
  "content": {
    "type": "card",
    "card": {
      "title": "Black Friday",
      "description": "50% OFF em toda a loja, só hoje!",
      "media": {
        "url": "https://exemplo.com/banners/bf.jpg",
        "height": "MEDIUM"
      },
      "orientation": "VERTICAL",
      "suggestions": [
        {
          "type": "OPEN_URL",
          "text": "Comprar agora",
          "url": "https://exemplo.com/black-friday"
        },
        {
          "type": "REPLY",
          "text": "Quero novidades",
          "postbackData": "subscribe_bf"
        }
      ]
    }
  }
}
```

Response:

```json
{
  "id": "c2572307-b0c7-46f8-8c1e-e4d5d7f0ce65",
  "status": "queued",
  "channel": "rcs",
  "reference": "c2572307-b0c7-46f8-8c1e-e4d5d7f0ce65",
  "createdAt": "2026-09-04T17:32:39.414Z"
}
```