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

const port = process.env.PORT || 4337;
const teneoEngineUrl = process.env.TENEO_ENGINE_URL;

const app = express();

// initalise teneo
const teneoApi = TIE.init(teneoEngineUrl);

// initialise session handler, to store mapping between sender's phone number and the engine session id
const sessionHandler = SessionHandler();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json()); // Asegurar que podamos recibir datos en formato JSON

// Ruta principal (esto antes respondía a "/")
app.post("/", handleTwilioMessages(sessionHandler));

// Nueva ruta para Twilio WhatsApp
app.post("/whatsapp", handleTwilioMessages(sessionHandler));

// Manejo de mensajes de Twilio
function handleTwilioMessages(sessionHandler) {
  return async (req, res) => {
    console.log("Solicitud recibida en /whatsapp");

    // Obtener el número del remitente
    const from = req.body.From;
    console.log(`from: ${from}`);

    // Obtener el mensaje enviado por el usuario
    const userInput = req.body.Body;
    console.log(`userInput: ${userInput}`);

    // Verificar si tenemos una sesión almacenada para este usuario
    const teneoSessionId = sessionHandler.getSession(from);

    try {
      // Enviar el input al motor de Teneo y recibir la respuesta
      const teneoResponse = await teneoApi.sendInput(teneoSessionId, { 'text': userInput, 'channel': 'twilio-whatsapp' });
      console.log(`teneoResponse: ${teneoResponse.output.text}`);

      // Almacenar el sessionId del motor de Teneo
      sessionHandler.setSession(from, teneoResponse.sessionId);

      // Responder a Twilio
      sendTwilioMessage(teneoResponse, res);

    } catch (error) {
      console.error("Error al procesar el mensaje con Teneo:", error);
      res.status(500).send("Error interno del servidor");
    }
  };
}

// Enviar mensaje de respuesta a Twilio
function sendTwilioMessage(teneoResponse, res) {
  const message = teneoResponse.output.text;
  const twiml = new MessagingResponse();

  twiml.message(message);

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
}

/***
 * SESSION HANDLER
 ***/
function SessionHandler() {
  const sessionMap = new Map();

  return {
    getSession: (userId) => {
      return sessionMap.get(userId) || "";
    },
    setSession: (userId, sessionId) => {
      sessionMap.set(userId, sessionId);
    }
  };
}

// Iniciar servidor HTTP
http.createServer(app).listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
