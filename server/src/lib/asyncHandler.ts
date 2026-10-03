import { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 не передаёт отклонённый промис из async-обработчика в error
// middleware — запрос молча зависал бы. Оборачиваем, чтобы ошибка дошла до
// обработчика в index.ts и клиент получил 500 вместо вечной загрузки.
export function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
