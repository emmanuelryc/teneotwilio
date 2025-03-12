/**
 * Copyright 2019 Artificial Solutions. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *    http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const TIE = require('@artificialsolutions/tie-api-client');

const port = process.env.PORT || 3000; // Usa el puerto de Railway o 3000 como fallback
const teneoEngineUrl = process.env.TENEO_ENGINE_URL;

if (!teneoEngineUrl) {
  console.error("ERROR: La variable de entorno TENEO_ENGINE_URL no está definida.");
  process.exit(1); // Detener la ejecución si falta la URL de Teneo
}

console.log(`✅ Servidor iniciando con la URL de Teneo: ${teneoEngineUrl}`);

const app = express();
const teneoApi = TIE.init(teneoEngineUrl);
const sessionHandler = SessionHandler();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Rutas disponibles
app.post("/", handleTwilioMessages(sessionHandler));
app.post("/whatsapp", handleTwilioMessages(sessionHandler));

function handleTwilioMessages(sessionHandler) {
  return async (req, res) => {
    console.log("📩 Mensaje recibido en /whatsapp");

    const from = req.body.From;
    const userInput = req.body.Body;

    console.log(`👤 De: ${from}`);
    console.log(`📝 Mensaje: ${userInput}`);

    if (!from || !userInput) {
      console.error("❌ Error: Datos inválidos en la solicitud.");
      return res.status(400).send("Solicitud inválida");
    }

    const teneoSessionId = sessionHandler.getSession(from);

    try {
      const teneoResponse = await teneoApi.sendInput(teneoSessionId, { 'text': userInput, 'channel': 'twilio-whatsapp' });

      console.log(`🤖 Respuesta de Teneo: ${teneoResponse.output.text}`);

      sessionHandler.setSession(from, teneoResponse.sessionId);
      sendTwilioMessage(teneoResponse, res);

    } catch (error) {
      console.error("❌ Error al procesar el mensaje con Teneo:", error);
      res.status(500).send("Error interno del servidor");
    }
  };
}

function sendTwilioMessage(teneoResponse, res) {
  const message = teneoResponse.output.text;
  const twiml = new MessagingResponse();

  twiml.message(message);

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
}

function SessionHandler() {
  const sessionMap = new Map();

  return {
    getSession: (userId) => sessionMap.get(userId) || "",
    setSession: (userId, sessionId) => sessionMap.set(userId, sessionId)
  };
}

http.createServer(app).listen(port, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${port}`);
});