import { Router } from "express";

import { login, profilSaya } from "../controllers/auth.controller.js";

import { autentikasi } from "../middleware/auth.middleware.js";

const routerAuth = Router();

routerAuth.post("/login", login);

routerAuth.get("/me", autentikasi, profilSaya);

export default routerAuth;
