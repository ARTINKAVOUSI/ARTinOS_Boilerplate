/**
 * ARTINOS integration for @artinos/scenes. This is the only entry point that
 * depends on `@artinos/runtime`.
 */
export { schemaToParameters, descriptorToParameter, schemaKeys, type SchemaToParametersOptions } from './schema-to-parameters';
export { useParameterValues } from './use-parameter-values';
export { ArtinosAdaptiveRoom, BOUNDS_RESOURCE, type ArtinosAdaptiveRoomProps } from './adaptive-room/ArtinosAdaptiveRoom';
export {
  adaptiveRoomKit,
  applyValues,
  ADAPTIVE_ROOM_STAGE,
  type AdaptiveRoomKit,
  type AdaptiveRoomKitOptions,
} from './adaptive-room/kit';
export {
  ids as roomParameterIds,
  HOST_IDS as roomHostParameterIds,
  roomParameters,
  roomRuntimePresets,
  roomStateToValues,
  readRoomState,
  ssgiFromIntensity,
} from './adaptive-room/parameters';
