import "react-native-reanimated";
import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { Alert, StyleSheet, ImageBackground } from "react-native";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
} from "react-native-vision-camera";
import { useFaceDetector } from "react-native-vision-camera-face-detector";
import { Worklets } from "react-native-worklets-core";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Spinner } from "@/components/ui/spinner";
import colors from "tailwindcss/colors";
import { appContext } from "@/src/context";
import { useNavigation } from "@react-navigation/native";
import RNFetchBlob from "rn-fetch-blob";
import ImageResizer from "react-native-image-resizer";

const image = require("../../../assets/fundo3.png"); // Caminho relativo para a imagem

/**
 * Verifica se o rosto está olhando para frente com ambos os olhos abertos.
 *
 * @param {object} rosto - Dados de detecção do rosto
 * @param {number} rosto.pitchAngle - Inclinação vertical
 * @param {number} rosto.rollAngle - Inclinação lateral
 * @param {number} rosto.yawAngle - Rotação esquerda/direita
 * @param {number} rosto.leftEyeOpenProbability - Probabilidade do olho esquerdo estar aberto
 * @param {number} rosto.rightEyeOpenProbability - Probabilidade do olho direito estar aberto
 * @returns {boolean} true se o rosto estiver olhando para frente e olhos abertos
 */
function estaOlhandoParaFrente(rosto) {
  const LIMITE_PITCH = 3;
  const LIMITE_ROLL = 10;
  const LIMITE_YAW = 10;
  const PROBABILIDADE_OLHO_ABERTO = 0.95;

  const {
    pitchAngle,
    rollAngle,
    yawAngle,
    leftEyeOpenProbability,
    rightEyeOpenProbability,
  } = rosto;

  const angulosValidos =
    Math.abs(pitchAngle) <= LIMITE_PITCH &&
    Math.abs(rollAngle) <= LIMITE_ROLL &&
    Math.abs(yawAngle) <= LIMITE_YAW;

  const olhosAbertos =
    leftEyeOpenProbability >= PROBABILIDADE_OLHO_ABERTO &&
    rightEyeOpenProbability >= PROBABILIDADE_OLHO_ABERTO;

  return angulosValidos && olhosAbertos;
}

export default function CameraScreen() {
  const faceDetectionOptions = useRef({
    landmarkMode: "all",
    classificationMode: "all",
  }).current;

  const device = useCameraDevice("front");
  const { detectFaces } = useFaceDetector(faceDetectionOptions);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [isGazing, setIsGazing] = useState(false);
  const [photo, setPhoto] = useState(true);
  const [spinner, setSpinner] = useState(false);
  const { setServerPhotoPath, matricula, setMatriculaFormatada } = appContext();
  const camera = useRef(null);
  const navigation = useNavigation();

  /**
   * Redimensiona e faz upload da imagem para o servidor Comlurb
   *
   * @param {string} imagePath - Caminho local da imagem
   * @param {string} imageName - Nome da imagem no servidor
   * @returns {Promise<string>} Resposta textual do servidor
   */
  const uploadImageToComlurb = async (imagePath, imageName) => {
    const url =
      "https://comlurbdev.rio.rj.gov.br/extranet/Fotos/fotoRecoginizer/upload.php";
    try {
      const { uri: resizedUri } = await ImageResizer.createResizedImage(
        imagePath.replace("file://", ""),
        224,
        224,
        "JPEG",
        80,
        0
      );

      const response = await RNFetchBlob.fetch(
        "POST",
        url,
        { "Content-Type": "multipart/form-data" },
        [
          {
            name: "imagem",
            filename: `${imageName}.jpg`,
            type: "image/jpeg",
            data: RNFetchBlob.wrap(resizedUri),
          },
          { name: "name", data: imageName },
        ]
      );

      return await response.text();
    } catch (error) {
      console.error("Erro no processamento/upload:", error);
      Alert.alert("Erro", "Falha ao enviar imagem para o servidor");
      navigation.navigate("ErrorPhoto");
      throw error;
    }
  };

  // Solicita permissão da câmera ao montar o componente
  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === "granted");
      if (status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Por favor, permita o acesso à câmera nas configurações do dispositivo"
        );
      }
    })();
  }, []);

  // Tirar foto quando o usuário estiver olhando para a câmera
  useEffect(() => {
    if (isGazing) {
      (async function takePhoto() {
        try {
          const photo = await camera.current.takePhoto();
          setPhoto(false);
          setServerPhotoPath(photo.path);
          setIsGazing(false);
          setSpinner(true);

          const cleanedPath = photo.path.replace(/^file:\/\//, "");
          let _primerioCaracter = matricula.toString().substring(0, 1);
          let _matricula;

          if (matricula.toString().length <= 6) {
            _matricula = "014" + matricula.toString().padStart(6, "0");
          } else if (
            _primerioCaracter === "8" &&
            matricula.toString().length >= 6
          ) {
            _matricula = "0" + matricula.toString().padStart(6, "0");
          } else {
            _matricula = matricula.toString().padStart(6, "0");
          }

          setMatriculaFormatada(_matricula);

          await uploadImageToComlurb(cleanedPath, _matricula);
          setSpinner(false);
          navigation.navigate("Sucesso");
        } catch (error) {
          console.error("Erro ao tirar foto:", error);
          setIsGazing(false);
          setPhoto(false);
        }
      })();
    }
  }, [isGazing]);

  // Atualiza estado do olhar do usuário
  const handleDetectedFaces = useCallback(
    Worklets.createRunOnJS((facesJson) => {
      try {
        const faces = JSON.parse(facesJson);
        if (Array.isArray(faces) && faces.length > 0) {
          setIsGazing(estaOlhandoParaFrente(faces[0]));
        }
        setDetectedFaces(faces);
      } catch (error) {
        console.error("Erro ao parsear JSON dos rostos:", error);
      }
    }),
    []
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      const faces = detectFaces(frame);
      handleDetectedFaces(JSON.stringify(faces));
    },
    [handleDetectedFaces]
  );

  if (!device) {
    return (
      <GluestackUIProvider mode='light'>
        <Box className='flex-1 bg-black justify-center items-center'>
          <Text className='text-white text-lg'>
            Nenhuma câmera frontal encontrada
          </Text>
        </Box>
      </GluestackUIProvider>
    );
  }

  if (!hasPermission) {
    return (
      <GluestackUIProvider mode='light'>
        <Box className='flex-1 bg-black justify-center items-center'>
          <Text className='text-white text-lg text-center p-4'>
            Aguardando permissão da câmera... Por favor, conceda a permissão nas
            configurações do aplicativo.
          </Text>
        </Box>
      </GluestackUIProvider>
    );
  }

  return (
    <GluestackUIProvider mode='light'>
      {!spinner ? (
        <Box className='flex-1'>
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={photo}
            frameProcessor={frameProcessor}
            frameProcessorFps={5}
            orientation='portrait'
            photo={photo}
            ref={camera}
            zoom={device.maxZoom}
          />
          <ImageBackground
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
            }}
            source={image}
            resizeMode='cover'
            className='absolute inset-0 z-10'
          />
          <Box className='absolute bottom-20 w-full bg-blue-500 p-4 items-center z-20'>
            <Text className='text-white text-3xl'>
              {isGazing ? "Olhando para a câmera" : "Olhe para a câmera"}
            </Text>
          </Box>
        </Box>
      ) : (
        <Box className='flex-1 bg-black justify-center items-center'>
          <Spinner size='large' className='text-green-50' />
        </Box>
      )}
    </GluestackUIProvider>
  );
}
