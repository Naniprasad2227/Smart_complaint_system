import React, { useState } from 'react';
import { complaintApi } from '../services/api';

const ImageDetection = ({ onDetectionComplete }) => {
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setSelectedImage(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDetect = async () => {
    if (!selectedImage) {
      setError('Please select an image first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await complaintApi.detectImage(selectedImage);
      setResult(response.data);
      if (onDetectionComplete) {
        onDetectionComplete(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to analyze image');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="gov-card p-8">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">
        🖼️ Image Complaint Detection
      </h2>
      <p className="text-gray-600 mb-8">
        Upload an image of an issue (pothole, broken street light, sanitation problem,
        etc.) and our AI will automatically detect the type of complaint and suggest the
        appropriate category and department.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div>
          <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center bg-blue-50">
            <label className="cursor-pointer">
              <div className="space-y-4">
                <p className="text-4xl">📸</p>
                <p className="text-gray-700 font-semibold">Click to upload image</p>
                <p className="text-sm text-gray-600">
                  or drag and drop
                </p>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF up to 5MB
                </p>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                disabled={loading}
                className="hidden"
              />
            </label>
          </div>

          {preview && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-700 mb-2">Preview:</p>
              <img
                src={preview}
                alt="Preview"
                className="w-full h-64 object-cover rounded-lg border border-gray-300"
              />
              <p className="text-xs text-gray-600 mt-2">
                {selectedImage?.name}
              </p>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="mt-6 flex space-x-4">
            <button
              onClick={handleDetect}
              disabled={!selectedImage || loading}
              className="gov-button-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              {loading ? 'Analyzing...' : 'Detect Issue'}
            </button>
            {preview && (
              <button
                onClick={handleReset}
                disabled={loading}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Results Section */}
        <div>
          {result ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <p className="text-green-800 font-semibold mb-4">
                  ✅ Analysis Complete
                </p>

                <div className="space-y-4">
                  {result.category && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Detected Category
                      </label>
                      <p className="text-lg font-semibold text-blue-600 px-3 py-2 border border-blue-300 rounded bg-blue-50">
                        {result.category}
                      </p>
                    </div>
                  )}

                  {result.priority && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Suggested Priority
                      </label>
                      <p
                        className={`text-lg font-semibold px-3 py-2 border rounded ${
                          result.priority === 'High'
                            ? 'text-red-600 border-red-300 bg-red-50'
                            : result.priority === 'Medium'
                            ? 'text-amber-600 border-amber-300 bg-amber-50'
                            : 'text-green-600 border-green-300 bg-green-50'
                        }`}
                      >
                        {result.priority}
                      </p>
                    </div>
                  )}

                  {result.department && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Assigned Department
                      </label>
                      <p className="text-lg font-semibold text-purple-600 px-3 py-2 border border-purple-300 rounded bg-purple-50">
                        {result.department}
                      </p>
                    </div>
                  )}

                  {result.description && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        AI Description
                      </label>
                      <p className="text-gray-700 px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm leadingrelaxed">
                        {result.description}
                      </p>
                    </div>
                  )}

                  {result.confidence && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Confidence  Score
                      </label>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${Math.min(100, result.confidence * 100)}%`,
                          }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {Math.round(result.confidence * 100)}% confident
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleReset}
                className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Analyze Another Image
              </button>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-600 text-center">
                Upload an image to see the AI analysis results here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Usage Tips */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-800 mb-4">💡 Tips for Best Results</h3>
        <ul className="text-sm text-gray-700 space-y-2">
          <li>✓ Take clear, well-lit photos of the issue</li>
          <li>✓ Include context (street, building, area visible)</li>
          <li>✓ Avoid blurry or dark images</li>
          <li>✓ Try different angles if first detection isn't accurate</li>
          <li>✓ Supported issues: Potholes, street lights, sanitation, debris, etc.</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageDetection;
