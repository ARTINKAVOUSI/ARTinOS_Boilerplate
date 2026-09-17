/** Quiet matte composition — floor-seated and safe-area fitted by the room. */
export function Sculpture({ palette }: { palette: string[] }) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[-0.28, 0.95, -0.1]}>
        <sphereGeometry args={[0.95, 96, 64]} />
        <meshStandardMaterial color={palette[0]} roughness={0.82} metalness={0.02} />
      </mesh>
      <mesh castShadow receiveShadow position={[1.02, 0.52, 0.55]}>
        <sphereGeometry args={[0.52, 80, 48]} />
        <meshStandardMaterial color={palette[1]} roughness={0.55} metalness={0.03} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.62, 0.28, 1.35]}>
        <sphereGeometry args={[0.28, 64, 40]} />
        <meshStandardMaterial color={palette[2]} roughness={0.28} metalness={0.1} />
      </mesh>
    </group>
  );
}
