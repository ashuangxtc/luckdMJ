import { motion } from 'framer-motion';
import backImageUrl from "@assets/generated_images/麻将牌背面图案_324a01cc.png";
import winnerImageUrl from "@assets/generated_images/红中麻将牌正面_8a7f2e08.png";
import loserImageUrl from "@assets/generated_images/白板麻将牌正面_0905cb27.png";

interface ShufflingMahjongTileProps {
  id: number;
  face: '红中' | '白板';
  phase: 'waiting' | 'showing-front' | 'flipping-back' | 'overlapping' | 'shuffling' | 'ready' | 'revealing' | 'finished';
  isSelected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  zIndex?: number;
}

const ShufflingMahjongTile = ({
  id,
  face,
  phase,
  isSelected = false,
  onClick,
  disabled = false,
  zIndex = 1,
}: ShufflingMahjongTileProps) => {
  const isWinner = face === '红中';
  const frontImage = isWinner ? winnerImageUrl : loserImageUrl;

  // 获取动画变体
  const getVariants = () => {
    const baseVariants = {
      initial: {
        scale: 0.8,
        opacity: 0,
        rotateY: 0,
        x: 0,
        y: 0,
        rotate: 0,
      },
      showingFront: {
        scale: 1,
        opacity: 1,
        rotateY: 180, // 显示正面
        x: 0,
        y: 0,
        rotate: 0,
        transition: { duration: 0.6, ease: "easeOut" }
      },
      flippingBack: {
        rotateY: 0, // 翻回背面
        transition: { duration: 0.8, ease: "easeInOut" }
      },
      overlapping: {
        x: 0,
        y: 0,
        scale: 1,
        rotate: 0,
        transition: { duration: 0.3, ease: "easeOut" }
      },
      shuffling: {
        x: [0, Math.random() * 100 - 50, Math.random() * 100 - 50, 0],
        y: [0, Math.random() * 50 - 25, Math.random() * 50 - 25, 0],
        rotate: [0, Math.random() * 20 - 10, Math.random() * 20 - 10, 0],
        transition: { 
          duration: 1.0, 
          ease: "easeInOut",
          times: [0, 0.3, 0.7, 1]
        }
      },
      ready: {
        x: 0,
        y: 0,
        rotate: 0,
        scale: 1,
        transition: { duration: 0.3, ease: "easeOut" }
      },
      revealing: {
        scale: 1.2,
        rotateY: 180, // 翻到正面
        transition: { duration: 0.6, ease: "easeOut" }
      },
      revealed: {
        scale: 1.1,
        rotateY: 180,
        transition: { duration: 0.2, ease: "easeOut" }
      }
    };

    return baseVariants;
  };

  const variants = getVariants();

  // 获取当前动画状态
  const getCurrentVariant = () => {
    switch (phase) {
      case 'showing-front':
        return 'showingFront';
      case 'flipping-back':
        return 'flippingBack';
      case 'overlapping':
        return 'overlapping';
      case 'shuffling':
        return 'shuffling';
      case 'ready':
        return 'ready';
      case 'revealing':
        return 'revealing';
      case 'finished':
        return 'revealed';
      default:
        return 'initial';
    }
  };

  return (
    <motion.div
      className="relative w-24 h-36 cursor-pointer"
      style={{ zIndex }}
      variants={variants}
      initial="initial"
      animate={getCurrentVariant()}
      onClick={disabled ? undefined : onClick}
      whileHover={phase === 'ready' && !disabled ? { scale: 1.05 } : {}}
      whileTap={phase === 'ready' && !disabled ? { scale: 0.95 } : {}}
    >
      <div className="relative w-full h-full" style={{ transformStyle: "preserve-3d" }}>
        {/* 背面 */}
        <motion.div
          className="absolute inset-0 w-full h-full rounded-lg shadow-lg"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(0deg)",
          }}
        >
          <img
            src={backImageUrl}
            alt="麻将牌背面"
            className="w-full h-full object-cover rounded-lg"
          />
        </motion.div>

        {/* 正面 */}
        <motion.div
          className="absolute inset-0 w-full h-full rounded-lg shadow-lg"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <img
            src={frontImage}
            alt={face}
            className="w-full h-full object-cover rounded-lg"
          />
        </motion.div>
      </div>

      {/* 选中状态指示器 */}
      {isSelected && phase === 'revealing' && (
        <motion.div
          className="absolute -inset-2 border-4 border-yellow-400 rounded-lg"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.div>
  );
};

export default ShufflingMahjongTile;
