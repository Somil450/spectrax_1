import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Activity } from 'lucide-react';
import { Replay3DModel } from './Replay3DModel';
import { AVATAR_SKINS } from '../utils/avatarSkins';
import { getExerciseFrames } from '../utils/mockExerciseFrames';

interface Props {
  onBack: () => void;
}

export const AvatarCustomizationScreen: React.FC<Props> = ({ onBack }) => {
  const [selectedSkin, setSelectedSkin] = useState<string>(AVATAR_SKINS.STANDARD_HUMAN);
  const [selectedExercise, setSelectedExercise] = useState<string>('squat');
  const [frames, setFrames] = useState(() => getExerciseFrames('squat'));

  useEffect(() => {
    setFrames(getExerciseFrames(selectedExercise));
  }, [selectedExercise]);

  return (
    <div className="screen-container" style={{ padding: 28, display: 'flex', flexDirection: 'column', height: '100vh', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <button
          onClick={onBack}
          className="btn-glass"
          style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeft size={18} />
          Back
        </button>
        <h2 style={{ marginLeft: 20, fontFamily: 'var(--font-heading)', color: 'var(--neon-cyan)', margin: 0 }}>
          Avatar Customization & Animation Library
        </h2>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 20, minHeight: 0 }}>
        {/* Left Side: Controls */}
        <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', paddingRight: 10 }}>
          
          <div className="card-glass" style={{ padding: 20 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--neon-purple)', marginTop: 0 }}>
              <User size={18} /> Avatar Skin
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.values(AVATAR_SKINS).map((skin) => (
                <button
                  key={skin}
                  onClick={() => setSelectedSkin(skin)}
                  className={`btn-glass ${selectedSkin === skin ? 'active' : ''}`}
                  style={{
                    textAlign: 'left',
                    borderColor: selectedSkin === skin ? 'var(--neon-cyan)' : 'var(--glass-border)',
                    boxShadow: selectedSkin === skin ? '0 0 10px rgba(0, 255, 255, 0.2)' : 'none',
                    color: selectedSkin === skin ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  {skin}
                </button>
              ))}
            </div>
          </div>

          <div className="card-glass" style={{ padding: 20 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--neon-green)', marginTop: 0 }}>
              <Activity size={18} /> Animation Library
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['squat', 'jumping jacks'].map((exercise) => (
                <button
                  key={exercise}
                  onClick={() => setSelectedExercise(exercise)}
                  className={`btn-glass ${selectedExercise === exercise ? 'active' : ''}`}
                  style={{
                    textAlign: 'left',
                    textTransform: 'capitalize',
                    borderColor: selectedExercise === exercise ? 'var(--neon-green)' : 'var(--glass-border)',
                    boxShadow: selectedExercise === exercise ? '0 0 10px rgba(0, 255, 0, 0.2)' : 'none',
                    color: selectedExercise === exercise ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  {exercise}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Right Side: 3D Preview */}
        <div className="card-glass" style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
          <Replay3DModel
            frames={frames}
            skin={selectedSkin}
            isPlaying={true}
            exerciseName={selectedExercise}
          />
        </div>
      </div>
    </div>
  );
};

export default AvatarCustomizationScreen;
