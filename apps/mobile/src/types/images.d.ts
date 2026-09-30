/** Static raster assets — typed for import so tsc understands image requires. */
declare module "*.jpg" {
  const value: import("react-native").ImageSourcePropType;
  export default value;
}
declare module "*.png" {
  const value: import("react-native").ImageSourcePropType;
  export default value;
}
