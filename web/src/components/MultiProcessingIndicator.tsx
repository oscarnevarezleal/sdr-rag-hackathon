import React from 'react';
import { FileText, Brain, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { MultiFileUploadState } from '../types';

interface MultiProcessingIndicatorProps {
  uploadState: MultiFileUploadState;
}

export default function MultiProcessingIndicator({ uploadState }: MultiProcessingIndicatorProps) {
  const getStepStatus = (stepProgress: number) => {
    if (uploadState.overallProgress >= stepProgress) return 'complete';
    if (uploadState.overallProgress >= stepProgress - 33) return 'active';
    return 'pending';
  };

  const steps = [
    { 
      id: 'upload', 
      label: 'Uploading Files', 
      icon: FileText, 
      status: getStepStatus(33),
      progress: 33
    },
    { 
      id: 'process', 
      label: 'Processing Documents', 
      icon: Brain, 
      status: getStepStatus(66),
      progress: 66
    },
    { 
      id: 'ready', 
      label: 'Ready to Chat', 
      icon: CheckCircle, 
      status: getStepStatus(100),
      progress: 100
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Processing Your Documents
        </h3>
        <p className="text-sm text-gray-600">
          {uploadState.completedCount} of {uploadState.totalCount} files processed
        </p>
      </div>
      
      {/* Overall Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Overall Progress</span>
          <span>{uploadState.overallProgress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="h-3 bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${uploadState.overallProgress}%` }}
          />
        </div>
      </div>

      {/* Step Progress */}
      <div className="space-y-4 mb-6">
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

      {/* Individual File Status */}
      {uploadState.files.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">File Status</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {uploadState.files.map((fileItem) => (
              <div key={fileItem.id} className="flex items-center space-x-2 text-xs">
                <div className="flex-shrink-0">
                  {fileItem.status === 'ready' && <CheckCircle className="w-3 h-3 text-green-500" />}
                  {fileItem.status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                  {(fileItem.status === 'uploading' || fileItem.status === 'processing') && (
                    <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                  )}
                  {fileItem.status === 'pending' && <FileText className="w-3 h-3 text-gray-400" />}
                </div>
                <span className="flex-1 truncate text-gray-600">{fileItem.file.name}</span>
                <span className={`font-medium ${
                  fileItem.status === 'ready' ? 'text-green-600' :
                  fileItem.status === 'error' ? 'text-red-600' :
                  'text-blue-600'
                }`}>
                  {fileItem.progress}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Summary */}
      {uploadState.overallStatus === 'error' && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Some files failed to process</span>
          </div>
        </div>
      )}
    </div>
  );
}