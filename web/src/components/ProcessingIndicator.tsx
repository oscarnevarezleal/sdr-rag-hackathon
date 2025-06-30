import React from 'react';
import { FileText, Brain, CheckCircle, Loader2 } from 'lucide-react';

interface ProcessingIndicatorProps {
  progress: number;
  fileName?: string;
}

export default function ProcessingIndicator({ progress, fileName }: ProcessingIndicatorProps) {
  const steps = [
    { id: 'upload', label: 'Uploading', icon: FileText, isComplete: progress >= 33, isActive: progress > 0 && progress < 33 },
    { id: 'process', label: 'Analyzing', icon: Brain, isComplete: progress >= 66, isActive: progress >= 33 && progress < 66 },
    { id: 'ready', label: 'Ready', icon: CheckCircle, isComplete: progress >= 100, isActive: progress >= 66 && progress < 100 }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Processing Your Document</h3>
        {fileName && (
          <p className="text-sm text-gray-600">{fileName}</p>
        )}
      </div>
      
      <div className="space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.status === 'active';
          const isComplete = step.status === 'complete';
          
          
          return (
            <div key={step.id} className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                isComplete ? 'bg-green-500 text-white' :
                isActive ? 'bg-blue-500 text-white animate-pulse' :
                'bg-gray-200 text-gray-400'
              }`}>
                {isActive && !isComplete ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              
              <span className={`text-sm font-medium transition-colors ${
                isComplete ? 'text-green-600' :
                isActive ? 'text-blue-600' :
                'text-gray-400'
              }`}>
                {step.label}
              </span>
              
              {index < steps.length - 1 && (
                <div className={`flex-1 h-px transition-colors ${
                  isComplete ? 'bg-green-200' : 'bg-gray-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-6">
        <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">{progress}% Complete</p>
      </div>
    </div>
  );
}