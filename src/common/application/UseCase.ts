/**
 * Core use case
 * 
 * @typeParam IRequest - type of the request passed to the use case
 * @typeParam IResponse - type of the response expected from the use case
 * 
 * @remarks
 * Defined as an interface because at this level it has no implementation.
 * 
 */
export interface UseCase<IRequest, IResponse> {
   execute (request?: IRequest) : Promise<IResponse> | IResponse;
}