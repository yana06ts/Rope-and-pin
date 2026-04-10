import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'motion/react';
import { Point, RopeType, NailData, Level } from '../types';
import { LEVELS } from '../constants';
import { Trophy, RefreshCcw, ChevronRight, ChevronLeft, Info, Pause, Lightbulb, MousePointer2, ShoppingBag, Settings, LogOut, Magnet, Wind } from 'lucide-react';

export default function Game() {
  const [view, setView] = useState<'home' | 'levels' | 'game' | 'shop'>('home');
  const [unlockedLevels, setUnlockedLevels] = useState<number>(1); // Level IDs start from 1
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [coins, setCoins] = useState(0);
  const [nails, setNails] = useState<NailData[]>([]);
  const [inventoryNails, setInventoryNails] = useState<NailData[]>([]);
  const [ropeOrder, setRopeOrder] = useState<string[]>([]);
  const [isWin, setIsWin] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [fixedShadows, setFixedShadows] = useState<string[]>([]);
  const [lastReleasedNailId, setLastReleasedNailId] = useState<string | null>(null);
  const [timeDilation, setTimeDilation] = useState(1);
  const [showIntro, setShowIntro] = useState(true);
  const [time, setTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHinting, setIsHinting] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const [hintNailId, setHintNailId] = useState<string | null>(null);
  const [similarity, setSimilarity] = useState(0);
  const [activeVirtualNail, setActiveVirtualNail] = useState<{ pos: Point, index: number } | null>(null);
  const [draggingNail, setDraggingNail] = useState<{ id: string, isFromInventory: boolean } | null>(null);
  const [hintTargetPos, setHintTargetPos] = useState<Point | null>(null);
  const [windDirection, setWindDirection] = useState<Point | null>(null);
  const [windStrength, setWindStrength] = useState(0);
  const [handPos, setHandPos] = useState<Point>({ x: 0, y: 0 });
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const level = LEVELS[currentLevelIndex];

  const handleNailPressStart = () => {
    if (level.id === 3) {
      longPressTimer.current = setTimeout(() => {
        setTimeDilation(0.7); // Slow down time (visual scale effect)
      }, 1500);
    }
  };

  const handleNailPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    setTimeDilation(1);
  };
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize level
  useEffect(() => {
    // Deep clone to prevent mutations and ensure fresh state
    setNails(level.nails.map(n => ({ ...n, position: { ...n.position } })));
    setInventoryNails((level.inventoryNails || []).map(n => ({ ...n, position: { ...n.position } })));
    setRopeOrder([...level.ropeOrder]);
    setIsWin(false);
    setSimilarity(0);
    setMultiplier(1);
    setFixedShadows([]);
    setLastReleasedNailId(null);
    setShowIntro(true);
    setTime(0);
    setIsPaused(false);
    setIsHinting(false);
    setDraggingNail(null);
    setActiveVirtualNail(null);
  }, [currentLevelIndex, level]);

  // Timer logic
  useEffect(() => {
    if (showIntro || isWin || isPaused) return;
    const timer = setInterval(() => {
      setTime(t => {
        const nextTime = t + 1;
        
        // Level 5: Wind logic
        if (level.id === 5 && nextTime % 5 === 0) {
          const angle = Math.random() * Math.PI * 2;
          const dir = { x: Math.cos(angle), y: Math.sin(angle) };
          setWindDirection(dir);
          setWindStrength(1);
          
          // Apply wind force to nails
          setNails(prev => prev.map(n => ({
            ...n,
            position: {
              x: n.position.x + dir.x * 15,
              y: n.position.y + dir.y * 15
            }
          })));

          // Fade out wind visual
          setTimeout(() => setWindStrength(0), 1000);
        }
        
        return nextTime;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showIntro, isWin, isPaused, level.id]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const showHint = () => {
    if (isHinting || isWin) return;
    
    // Find a nail that isn't at its target position
    const targetPoints = level.targetPath.match(/(\d+ \d+)/g)?.map(p => {
      const [x, y] = p.split(' ').map(Number);
      return { x, y };
    }) || [];

    const nailToMove = nails.find(n => {
      return !targetPoints.some(tp => 
        Math.sqrt(Math.pow(n.position.x - tp.x, 2) + Math.pow(n.position.y - tp.y, 2)) < 10
      );
    });

    if (nailToMove) {
      const target = targetPoints.find(tp => 
        !nails.some(n => Math.sqrt(Math.pow(n.position.x - tp.x, 2) + Math.pow(n.position.y - tp.y, 2)) < 10)
      );

      if (target) {
        setIsHinting(true);
        setHintNailId(nailToMove.id);
        setHintTargetPos(target);
        setHandPos(nailToMove.position);

        // Animate hand and nail
        let start: number | null = null;
        const duration = 2000;
        const startPos = nailToMove.position;

        const animate = (timestamp: number) => {
          if (!start) start = timestamp;
          const elapsed = timestamp - start;

          if (elapsed < duration) {
            // Phase 1: Move to target
            const progress = elapsed / duration;
            const currentX = startPos.x + (target.x - startPos.x) * progress;
            const currentY = startPos.y + (target.y - startPos.y) * progress;
            
            setHandPos({ x: currentX, y: currentY });
            handleNailMove(nailToMove.id, { x: currentX, y: currentY });
            requestAnimationFrame(animate);
          } else if (elapsed < duration * 2) {
            // Phase 2: Move back to start
            const progress = (elapsed - duration) / duration;
            const currentX = target.x + (startPos.x - target.x) * progress;
            const currentY = target.y + (startPos.y - target.y) * progress;
            
            setHandPos({ x: currentX, y: currentY });
            handleNailMove(nailToMove.id, { x: currentX, y: currentY });
            requestAnimationFrame(animate);
          } else {
            // Finish
            setIsHinting(false);
            setHintNailId(null);
            setHintTargetPos(null);
          }
        };
        requestAnimationFrame(animate);
      }
    }
  };

  const handleNailMove = (id: string, newPos: Point, isFromInventory: boolean = false) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Scale coordinates based on viewBox (450x850)
    const scaleX = 450 / rect.width;
    const scaleY = 850 / rect.height;
    
    const scaledPos = {
      x: newPos.x * scaleX,
      y: newPos.y * scaleY
    };

    if (isFromInventory) {
      setInventoryNails(prev => prev.map(n => n.id === id ? { ...n, position: scaledPos } : n));
      return;
    }

    setNails(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, position: scaledPos } : n);
      
      // Level 3: Catching logic
      if (level.id === 3 && ropeOrder.includes(id)) {
        const boardNailsNotInRope = updated.filter(n => !ropeOrder.includes(n.id));
        
        for (const targetNail of boardNailsNotInRope) {
          const dist = Math.sqrt(
            Math.pow(newPos.x - targetNail.position.x, 2) + 
            Math.pow(newPos.y - targetNail.position.y, 2)
          );
          
          if (dist < 30) { // Catch threshold
            setRopeOrder(currentOrder => {
              if (currentOrder.includes(targetNail.id)) return currentOrder;
              const idx = currentOrder.indexOf(id);
              const newOrder = [...currentOrder];
              newOrder.splice(idx + 1, 0, targetNail.id);
              return newOrder;
            });
            break; 
          }
        }
      }

      // Level 2, 3, 5 & 6: Elasticity logic
      if (level.id === 2 || level.id === 3 || level.id === 5 || level.id === 6) {
        const movedNail = updated.find(n => n.id === id);
        if (movedNail?.type === RopeType.Elastic) {
          const idx = ropeOrder.indexOf(id);
          if (idx !== -1) {
            const prevId = ropeOrder[(idx - 1 + ropeOrder.length) % ropeOrder.length];
            const nextId = ropeOrder[(idx + 1) % ropeOrder.length];
            
            return updated.map(n => {
              if (n.id === prevId || n.id === nextId) {
                const dx = movedNail.position.x - n.position.x;
                const dy = movedNail.position.y - n.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 50) {
                  return {
                    ...n,
                    position: {
                      x: n.position.x + dx * 0.08,
                      y: n.position.y + dy * 0.08
                    }
                  };
                }
              }
              return n;
            });
          }
        }
      }
      return updated;
    });
  };

  const handlePointerDown = (e: React.PointerEvent, id: string, isFromInventory: boolean) => {
    if (isWin || isPaused) return;

    // Rusty nail logic
    if (!isFromInventory) {
      const nail = nails.find(n => n.id === id);
      if (nail?.type === RopeType.Rusty && nail.moved) {
        return;
      }
    }

    setDraggingNail({ id, isFromInventory });
    handleNailPressStart();
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingNail) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        handleNailMove(draggingNail.id, {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        }, draggingNail.isFromInventory);
      }
    } else if (activeVirtualNail) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const scaleX = 450 / rect.width;
        const scaleY = 850 / rect.height;
        const scaledPos = {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
        };
        setActiveVirtualNail(prev => prev ? { ...prev, pos: scaledPos } : null);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingNail) {
      // Rusty nail logic
      if (!draggingNail.isFromInventory) {
        setNails(prev => prev.map(n => 
          n.id === draggingNail.id && n.type === RopeType.Rusty 
            ? { ...n, moved: true } 
            : n
        ));
      }

      handleNailRelease(draggingNail.id, draggingNail.isFromInventory);
      setDraggingNail(null);
      handleNailPressEnd();
    } else if (activeVirtualNail) {
      handleRopePointerUp(e);
    }
  };

  const handleNailRelease = (id: string, isFromInventory: boolean = false) => {
    if (isFromInventory) {
      const nail = inventoryNails.find(n => n.id === id);
      if (nail && nail.position.y < 700) { // If dropped on the board area
        setNails(prev => [...prev, nail]);
        setInventoryNails(prev => prev.filter(n => n.id !== id));
      } else {
        // Snap back to original inventory position
        const originalNail = level.inventoryNails?.find(n => n.id === id);
        if (originalNail) {
          setInventoryNails(prev => prev.map(n => 
            n.id === id ? { ...n, position: { ...originalNail.position } } : n
          ));
        }
      }
      return;
    }

    // Level 4: Magnet snap back logic
    if (level.id === 4) {
      const magnetPos = { x: 225, y: 425 };
      const targetPoints = level.targetPath.match(/(\d+ \d+)/g)?.map(p => {
        const [x, y] = p.split(' ').map(Number);
        return { x, y };
      }) || [];

      setNails(prev => prev.map(n => {
        if (n.id === id) {
          // Check if near any target point
          const isNearTarget = targetPoints.some(tp => {
            const dist = Math.sqrt(Math.pow(n.position.x - tp.x, 2) + Math.pow(n.position.y - tp.y, 2));
            return dist < 30;
          });

          if (!isNearTarget) {
            const distToMagnet = Math.sqrt(Math.pow(n.position.x - magnetPos.x, 2) + Math.pow(n.position.y - magnetPos.y, 2));
            if (distToMagnet < 300) { // Increased influence radius
              return { ...n, position: { ...magnetPos } };
            }
          }
        }
        return n;
      }));
    }

    checkWin();
  };

  const handleRopePointerDown = (e: React.PointerEvent, index: number) => {
    if (level.id !== 3 || isWin) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scaleX = 450 / rect.width;
    const scaleY = 850 / rect.height;

    const pos = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };

    setActiveVirtualNail({ pos, index: index + 1 });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleRopePointerMove = (e: React.PointerEvent) => {
    if (!activeVirtualNail) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setActiveVirtualNail(prev => prev ? {
      ...prev,
      pos: {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    } : null);
  };

  const handleRopePointerUp = (e: React.PointerEvent) => {
    if (!activeVirtualNail) return;
    
    // Check if released near a free nail
    const freeNails = nails.filter(n => !ropeOrder.includes(n.id));
    const targetNail = freeNails.find(n => 
      Math.sqrt(Math.pow(n.position.x - activeVirtualNail.pos.x, 2) + Math.pow(n.position.y - activeVirtualNail.pos.y, 2)) < 40
    );

    if (targetNail) {
      setRopeOrder(prev => {
        const next = [...prev];
        next.splice(activeVirtualNail.index, 0, targetNail.id);
        return next;
      });
    }

    setActiveVirtualNail(null);
  };

  const checkWin = () => {
    // Target points for the silhouette
    const targetPoints = level.targetPath.match(/(\d+ \d+)/g)?.map(p => {
      const [x, y] = p.split(' ').map(Number);
      return { x, y };
    }) || [];

    // Check if every target point has a nail close to it
    const matchedCount = targetPoints.filter(tp => 
      nails.some(n => {
        const dist = Math.sqrt(Math.pow(n.position.x - tp.x, 2) + Math.pow(n.position.y - tp.y, 2));
        return dist < 25; // Snap threshold
      })
    ).length;

    const currentSimilarity = Math.round((matchedCount / targetPoints.length) * 100);
    setSimilarity(currentSimilarity);

    const allMatched = matchedCount === targetPoints.length;

    // Level 3 specific: check if all nails are connected to the rope
    const totalRequiredNails = (level.nails.length + (level.inventoryNails?.length || 0));
    const isRopeComplete = ropeOrder.length >= totalRequiredNails;

    // Sequence check: Ensure nails are connected in the correct order to match the silhouette
    const currentRopePoints = ropeOrder.map(id => nails.find(n => n.id === id)?.position).filter(Boolean) as Point[];
    let isCorrectSequence = false;
    
    if (currentRopePoints.length === targetPoints.length) {
      const n = targetPoints.length;
      for (let start = 0; start < n; start++) {
        let forwardMatch = true;
        let backwardMatch = true;
        for (let i = 0; i < n; i++) {
          const p1 = currentRopePoints[i];
          const p2Forward = targetPoints[(start + i) % n];
          const p2Backward = targetPoints[(start - i + n) % n];
          
          const distF = Math.sqrt(Math.pow(p1.x - p2Forward.x, 2) + Math.pow(p1.y - p2Forward.y, 2));
          const distB = Math.sqrt(Math.pow(p1.x - p2Backward.x, 2) + Math.pow(p1.y - p2Backward.y, 2));
          
          if (distF > 45) forwardMatch = false; // Relaxed threshold
          if (distB > 45) backwardMatch = false; // Relaxed threshold
          if (!forwardMatch && !backwardMatch) break;
        }
        if (forwardMatch || backwardMatch) {
          isCorrectSequence = true;
          break;
        }
      }
    } else if (level.id !== 3) {
      // For levels where we don't expect a closed loop of exact length yet
      // Or if the logic needs to be more flexible
      isCorrectSequence = allMatched; 
    }

    if (allMatched && (isCorrectSequence || level.id === 3) && isRopeComplete && !isWin) {
      setCoins(prev => prev + 5);
      // Snap nails to target positions
      setNails(prev => prev.map(n => {
        const closestTarget = targetPoints.find(tp => 
          Math.sqrt(Math.pow(n.position.x - tp.x, 2) + Math.pow(n.position.y - tp.y, 2)) < 25
        );
        return closestTarget ? { ...n, position: closestTarget } : n;
      }));
      
      setIsWin(true);
      
      // Unlock next level
      const nextLevelId = level.id + 1;
      if (nextLevelId <= LEVELS.length && nextLevelId > unlockedLevels) {
        setUnlockedLevels(nextLevelId);
      }

      // Play a "click" sound effect (visual feedback)
      if (containerRef.current) {
        containerRef.current.style.filter = 'brightness(1.5)';
        setTimeout(() => {
          if (containerRef.current) containerRef.current.style.filter = 'none';
        }, 100);
      }
    }
  };

  const generateRopePath = () => {
    if (nails.length === 0 || ropeOrder.length === 0) return '';
    let points = ropeOrder.map(id => nails.find(n => n.id === id)?.position).filter(Boolean) as Point[];
    
    if (activeVirtualNail) {
      const newPoints = [...points];
      newPoints.splice(activeVirtualNail.index, 0, activeVirtualNail.pos);
      points = newPoints;
    }

    if (points.length < 2) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    path += ' Z';
    return path;
  };

  const ropePath = useMemo(generateRopePath, [nails, ropeOrder, activeVirtualNail]);

  const resetLevel = () => {
    // Deep copy to ensure fresh positions
    setNails(level.nails.map(n => ({ ...n, position: { ...n.position } })));
    setInventoryNails(level.inventoryNails || []);
    setRopeOrder(level.ropeOrder);
    setFixedShadows([]);
    setMultiplier(1);
    setIsWin(false);
    setResetCount(prev => prev + 1);
  };

  const nextLevel = () => {
    if (currentLevelIndex < LEVELS.length - 1) {
      setCurrentLevelIndex(prev => prev + 1);
    } else {
      setView('levels');
    }
  };

  const selectLevel = (index: number) => {
    setCurrentLevelIndex(index);
    setView('game');
  };

  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-center overflow-hidden bg-neutral-950">
      <div 
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="wood-board relative w-full h-full md:max-w-[450px] md:max-h-[850px] md:h-[90vh] md:aspect-[9/17] rounded-none md:rounded-3xl shadow-2xl border-x-4 border-b-4 border-[#3d2b1a] overflow-hidden touch-none select-none"
      >
        <div className="wood-grain" />
        
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 bg-black/20"
            >
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center mb-12"
              >
                <h1 className="text-6xl font-black text-white tracking-tighter mb-2 drop-shadow-2xl">
                  ROPE<br/><span className="text-yellow-600">&</span>PIN
                </h1>
                <p className="text-neutral-400 font-mono tracking-[0.2em] uppercase text-xs">Приключение в мире теней</p>
              </motion.div>

              <div className="flex flex-col gap-4 w-full max-w-[240px]">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setView('levels')}
                  className="group relative py-4 px-8 bg-white text-black font-black rounded-full overflow-hidden transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                >
                  <span className="relative z-10 text-xl uppercase tracking-widest">Играть</span>
                  <motion.div 
                    className="absolute inset-0 bg-yellow-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300"
                  />
                </motion.button>

                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setView('shop')}
                    className="py-3 px-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl border border-white/10 flex flex-col items-center gap-1 transition-all"
                  >
                    <ShoppingBag size={20} />
                    <span className="text-[10px] uppercase font-bold tracking-widest">Магазин</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="py-3 px-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl border border-white/10 flex flex-col items-center gap-1 transition-all"
                  >
                    <Settings size={20} />
                    <span className="text-[10px] uppercase font-bold tracking-widest">Настройки</span>
                  </motion.button>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="py-3 px-8 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl border border-red-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  <LogOut size={18} />
                  <span className="text-xs uppercase font-bold tracking-[0.2em]">Выход</span>
                </motion.button>
              </div>

              <div className="absolute top-8 right-8 flex items-center gap-2 bg-black/40 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
                <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(234,179,8,0.5)]">
                  <span className="text-[10px] font-black text-black">C</span>
                </div>
                <span className="text-sm font-bold text-white font-mono">{coins}</span>
              </div>
            </motion.div>
          )}

          {view === 'shop' && (
            <motion.div 
              key="shop"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 z-50 flex flex-col p-8 bg-black/40 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => setView('home')}
                  className="p-2 text-white/60 hover:text-white transition-colors"
                >
                  <ChevronLeft size={32} />
                </button>
                <h2 className="text-2xl font-bold text-white tracking-widest uppercase">Магазин</h2>
                <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full">
                  <div className="w-4 h-4 bg-yellow-500 rounded-full" />
                  <span className="text-sm font-bold text-white">{coins}</span>
                </div>
              </div>

              <div className="flex flex-col gap-6 overflow-y-auto pb-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-mono text-yellow-500 uppercase tracking-widest">Поверхности стола</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {[
                      { name: 'Темный дуб', price: 0, img: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=400&h=200', owned: true },
                      { name: 'Красное дерево', price: 50, img: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=400&h=200', owned: false },
                      { name: 'Светлая береза', price: 100, img: 'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?auto=format&fit=crop&q=80&w=400&h=200', owned: false },
                      { name: 'Мраморная плита', price: 250, img: 'https://images.unsplash.com/photo-1590272456521-1bbe160a18ce?auto=format&fit=crop&q=80&w=400&h=200', owned: false },
                    ].map((item, idx) => (
                      <div key={idx} className="group relative aspect-[2/1] rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                        <img src={item.img} alt={item.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 p-4 flex flex-col justify-end bg-gradient-to-t from-black/80 to-transparent">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white font-bold text-sm tracking-wide">{item.name}</p>
                              <p className="text-[10px] text-white/40 uppercase">Текстура стола</p>
                            </div>
                            <button className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                              item.owned ? 'bg-white/10 text-white/40' : 'bg-yellow-500 text-black hover:scale-105'
                            }`}>
                              {item.owned ? 'Выбрано' : `${item.price} монет`}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'levels' && (
            <motion.div 
              key="levels"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 z-50 flex flex-col p-8 bg-black/40 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-12">
                <button 
                  onClick={() => setView('home')}
                  className="p-2 text-white/60 hover:text-white transition-colors"
                >
                  <ChevronLeft size={32} />
                </button>
                <h2 className="text-2xl font-bold text-white tracking-widest uppercase">Уровни</h2>
                <div className="w-10" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {LEVELS.map((l, i) => {
                  const isLocked = l.id > unlockedLevels;
                  return (
                    <motion.button
                      key={l.id}
                      whileHover={!isLocked ? { scale: 1.05, y: -5 } : {}}
                      whileTap={!isLocked ? { scale: 0.95 } : {}}
                      onClick={() => !isLocked && selectLevel(i)}
                      className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border-2 ${
                        isLocked 
                          ? 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed' 
                          : 'bg-white/10 border-white/10 text-white hover:bg-white/20 hover:border-yellow-500/50 shadow-lg'
                      }`}
                    >
                      {isLocked ? (
                        <Pause size={24} className="opacity-20" />
                      ) : (
                        <span className="text-2xl font-black">{l.id}</span>
                      )}
                      <span className="text-[10px] uppercase tracking-tighter opacity-60">
                        {isLocked ? 'Закрыто' : 'Старт'}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {view === 'game' && (
            <motion.div 
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              {/* Top Panel */}
              <div className="absolute top-0 left-0 right-0 h-14 bg-black/60 backdrop-blur-xl border-b border-white/10 flex flex-col z-30">
                <div className="flex items-center justify-between px-6 h-14 relative">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setView('levels')}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white"
                    >
                      <ChevronLeft size={20} />
                    </button>
                  </div>

                  <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <span className="text-[10px] font-mono text-yellow-500 uppercase tracking-[0.3em] font-bold">Level {level.id}</span>
                    <span className={`text-lg font-black font-mono leading-none ${similarity > 80 ? 'text-green-400' : similarity > 40 ? 'text-yellow-400' : 'text-white'}`}>
                      {similarity}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={resetLevel}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white"
                      title="Сбросить поле"
                    >
                      <RefreshCcw size={18} />
                    </button>
                    <button 
                      onClick={showHint}
                      disabled={isHinting}
                      className={`p-2 rounded-lg transition-all flex items-center gap-2 ${
                        isHinting ? 'bg-yellow-500/20 text-yellow-500' : 'bg-white/5 hover:bg-white/10 text-white'
                      }`}
                    >
                      <Lightbulb size={20} className={isHinting ? 'animate-pulse' : ''} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Lantern Light Effect */}
              <div className="absolute top-[100px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-yellow-100/10 blur-[100px] rounded-full pointer-events-none" />

              <svg 
                viewBox="0 0 450 850" 
                preserveAspectRatio="xMidYMid slice"
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                <defs>
                  <filter id="hemp-texture">
                    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" result="noise" />
                    <feDiffuseLighting in="noise" lightingColor="#8b7355" surfaceScale="2">
                      <feDistantLight azimuth="45" elevation="60" />
                    </feDiffuseLighting>
                  </filter>
                </defs>
                {/* Target Silhouette */}
                <path 
                  d={level.targetPath} 
                  fill="none" 
                  stroke="rgba(255, 255, 255, 0.15)" 
                  strokeWidth="4" 
                  strokeDasharray="8 4"
                />

                {/* Magnet (Level 4) */}
                {level.id === 4 && (
                  <g transform="translate(225, 425)">
                    <circle r="40" fill="rgba(255, 0, 0, 0.15)" className="animate-pulse" />
                    <foreignObject x="-20" y="-20" width="40" height="40">
                      <div className="w-full h-full flex items-center justify-center text-red-500/80 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]">
                        <Magnet size={32} />
                      </div>
                    </foreignObject>
                  </g>
                )}

                {/* Wind Effect (Level 5) */}
                {level.id === 5 && windDirection && (
                  <motion.g
                    initial={{ opacity: 0 }}
                    animate={{ opacity: windStrength * 0.3 }}
                    className="pointer-events-none"
                  >
                    {[...Array(10)].map((_, i) => (
                      <motion.line
                        key={i}
                        x1={Math.random() * 450}
                        y1={Math.random() * 850}
                        x2={Math.random() * 450 + windDirection.x * 100}
                        y2={Math.random() * 850 + windDirection.y * 100}
                        stroke="white"
                        strokeWidth="1"
                        strokeDasharray="10 20"
                        animate={{ 
                          x: [0, windDirection.x * 200],
                          y: [0, windDirection.y * 200],
                          opacity: [0, 1, 0]
                        }}
                        transition={{ 
                          duration: 0.8, 
                          repeat: Infinity,
                          delay: Math.random() * 0.5
                        }}
                      />
                    ))}
                    <foreignObject x="20" y="100" width="100" height="100">
                      <div className="text-white/20 animate-bounce">
                        <Wind size={48} style={{ transform: `rotate(${Math.atan2(windDirection.y, windDirection.x)}rad)` }} />
                      </div>
                    </foreignObject>
                  </motion.g>
                )}

                {/* Fixed Shadows (Level 3) */}
                {fixedShadows.map((path, i) => (
                  <path 
                    key={i}
                    d={path}
                    fill="rgba(0, 0, 0, 0.4)"
                    stroke="rgba(0, 0, 0, 0.6)"
                    strokeWidth="12"
                    className="blur-[2px]"
                  />
                ))}

                {/* Shadow */}
                <path 
                  d={ropePath} 
                  fill="rgba(0, 0, 0, 0.3)" 
                  stroke="rgba(0, 0, 0, 0.5)" 
                  strokeWidth="12" 
                  className="blur-[4px]"
                  style={{ transform: 'translate(10px, 10px)' }}
                />

                {/* Rope */}
                <path 
                  d={ropePath} 
                  fill="none" 
                  stroke="#8b7355" 
                  strokeWidth="8" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="drop-shadow-sm"
                  filter="url(#hemp-texture)"
                />

                {/* Interactive Rope Segments (Invisible Hit Area) */}
                {level.id === 3 && ropeOrder.map((id, i) => {
                  const p1 = nails.find(n => n.id === id)?.position;
                  const nextId = ropeOrder[(i + 1) % ropeOrder.length];
                  const p2 = nails.find(n => n.id === nextId)?.position;
                  if (!p1 || !p2) return null;

                  return (
                    <path
                      key={`seg-${i}`}
                      d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`}
                      stroke="transparent"
                      strokeWidth="40"
                      className="cursor-crosshair pointer-events-auto"
                      onPointerDown={(e) => handleRopePointerDown(e, i)}
                    />
                  );
                })}

                {/* Nails */}
                {nails.map((nail) => (
                  <foreignObject
                    key={`${nail.id}-${resetCount}`}
                    x={nail.position.x - 20}
                    y={nail.position.y - 20}
                    width="40"
                    height="40"
                    className="overflow-visible pointer-events-auto"
                  >
                    <div
                      onPointerDown={(e) => handlePointerDown(e, nail.id, false)}
                      className={`w-10 h-10 rounded-full cursor-grab active:cursor-grabbing flex items-center justify-center transition-shadow ${
                        nail.type === RopeType.Elastic ? 'nail-head-red' : 
                        nail.type === RopeType.Rusty ? 'nail-head-rusty' : 'nail-head'
                      } ${ropeOrder.includes(nail.id) ? 'ring-2 ring-yellow-500/50' : ''} ${nail.type === RopeType.Rusty && nail.moved ? 'opacity-80 grayscale-[0.3]' : ''}`}
                    >
                      <div className="w-3 h-3 rounded-full bg-white/20" />
                    </div>
                  </foreignObject>
                ))}

                {/* Inventory Nails */}
                {level.id === 3 && inventoryNails.map((nail) => (
                  <foreignObject
                    key={`${nail.id}-${resetCount}`}
                    x={nail.position.x - 20}
                    y={nail.position.y - 20}
                    width="40"
                    height="40"
                    className="overflow-visible pointer-events-auto"
                  >
                    <div
                      onPointerDown={(e) => handlePointerDown(e, nail.id, true)}
                      className="w-10 h-10 rounded-full nail-head flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg"
                    >
                      <div className="w-3 h-3 rounded-full bg-white/20" />
                    </div>
                  </foreignObject>
                ))}

                {/* Phantom Hand */}
                {isHinting && (
                  <foreignObject
                    x={handPos.x}
                    y={handPos.y}
                    width="48"
                    height="48"
                    className="overflow-visible pointer-events-none"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 1.2 }}
                      animate={{ opacity: 0.6, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="text-white/80"
                    >
                      <MousePointer2 size={48} className="-rotate-45 drop-shadow-2xl" />
                    </motion.div>
                  </foreignObject>
                )}
              </svg>

              {/* Inventory Bar Background */}
              {level.id === 3 && inventoryNails.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-black/40 backdrop-blur-md border-t border-white/10 z-10 pointer-events-none" />
              )}


              {/* Win Overlay */}
              <AnimatePresence>
                {isWin && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-green-900/40 backdrop-blur-sm flex flex-col items-center justify-center z-50"
                  >
                    <motion.div
                      initial={{ scale: 0.5, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      className="bg-neutral-900 p-6 md:p-8 rounded-2xl border-2 border-green-500 shadow-2xl flex flex-col items-center gap-4 w-[90%] max-w-[320px]"
                    >
                      <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                        <Trophy className="text-white w-8 h-8" />
                      </div>
                      <h2 className="text-2xl font-bold text-white">Уровень пройден!</h2>
                      
                      <div className="flex flex-col gap-2 w-full bg-white/5 p-4 rounded-xl border border-white/10">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-white/40 uppercase tracking-widest">Время</span>
                          <span className="text-sm font-bold text-white font-mono">{formatTime(time)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-white/40 uppercase tracking-widest">Награда</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-bold text-yellow-500">+5</span>
                            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 w-full mt-4">
                        <button 
                          onClick={resetLevel}
                          className="flex-1 py-3 px-4 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <RefreshCcw size={18} />
                          Заново
                        </button>
                        <button 
                          onClick={nextLevel}
                          className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-500 rounded-xl transition-colors flex items-center justify-center gap-2 font-bold"
                        >
                          Далее
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Intro Overlay */}
              <AnimatePresence>
                {showIntro && (
                  <motion.div 
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-40 p-8 text-center"
                  >
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="flex flex-col items-center gap-4 max-w-[280px]"
                    >
                      <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center border border-yellow-500/50">
                        <Info className="text-yellow-500" size={20} />
                      </div>
                      <div>
                        <h3 className="text-xs font-mono text-yellow-500 uppercase tracking-[0.3em] mb-1">Уровень {level.id}</h3>
                        <h2 className="text-2xl font-bold text-white mb-3">{level.name}</h2>
                        <p className="text-neutral-300 text-sm leading-relaxed">{level.rule}</p>
                      </div>
                      <button 
                        onClick={() => setShowIntro(false)}
                        className="mt-2 py-3 px-10 bg-white text-black text-sm font-bold rounded-full hover:bg-neutral-200 transition-colors"
                      >
                        Начать
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
