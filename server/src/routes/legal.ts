import { Router } from "express";
import { privacyHtml, privacyPolicy } from "../lib/legal";

export const legalRouter = Router();

// Без авторизации: политику нужно прочитать до регистрации.
legalRouter.get("/legal/privacy", (_req, res) => res.json(privacyPolicy()));
legalRouter.get("/privacy", (_req, res) => res.type("html").send(privacyHtml()));
