import React, { useState, useEffect } from 'react';

function RuleSelector({ rules, onChange, disabled }) {
  const [ruleType, setRuleType] = useState(rules?.type || 'unanimous');
  const [thresholdValue, setThresholdValue] = useState(
    rules?.type === 'threshold' ? rules.value : 0.5
  );

  useEffect(() => {
    if (rules) {
      setRuleType(rules.type);
      if (rules.type === 'threshold') {
        setThresholdValue(rules.value);
      }
    }
  }, [rules]);

  const handleRuleTypeChange = (e) => {
    const newType = e.target.value;
    setRuleType(newType);
    
    if (newType === 'unanimous') {
      onChange({ type: 'unanimous' });
    } else if (newType === 'threshold') {
      onChange({ type: 'threshold', value: thresholdValue });
    }
  };

  const handlePercentageChange = (e) => {
    const percentage = parseInt(e.target.value, 10);
    const value = percentage / 100;
    setThresholdValue(value);
    onChange({ type: 'threshold', value });
  };

  const getThresholdPercentage = () => {
    return Math.round(thresholdValue * 100);
  };

  return (
    <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
      <div className="flex flex-col gap-3 mb-4">
        <label className={`flex items-start gap-3 p-4 bg-zinc-800 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-500 ${
          ruleType === 'unanimous' ? 'border-blue-500 bg-zinc-800/80' : 'border-zinc-700'
        }`}>
          <input
            type="radio"
            name="ruleType"
            value="unanimous"
            checked={ruleType === 'unanimous'}
            onChange={handleRuleTypeChange}
            disabled={disabled}
            className="mt-1 w-4 h-4 accent-blue-500 cursor-pointer disabled:cursor-not-allowed"
          />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-zinc-200">Unanimous</span>
            <span className="text-zinc-400 text-sm">
              All members must approve for candidates to become matches
            </span>
          </div>
        </label>

        <label className={`flex items-start gap-3 p-4 bg-zinc-800 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-500 ${
          ruleType === 'threshold' ? 'border-blue-500 bg-zinc-800/80' : 'border-zinc-700'
        }`}>
          <input
            type="radio"
            name="ruleType"
            value="threshold"
            checked={ruleType === 'threshold'}
            onChange={handleRuleTypeChange}
            disabled={disabled}
            className="mt-1 w-4 h-4 accent-blue-500 cursor-pointer disabled:cursor-not-allowed"
          />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-zinc-200">Threshold</span>
            <span className="text-zinc-400 text-sm">
              A percentage of members must approve
            </span>
          </div>
        </label>
      </div>

      {ruleType === 'threshold' && (
        <div className="mt-4 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
          <div className="mb-4">
            <label htmlFor="threshold-percentage" className="block mb-3 text-sm text-zinc-300">
              Approval Threshold: <span className="text-blue-400 text-lg font-semibold">{getThresholdPercentage()}%</span>
            </label>
            <input
              type="range"
              id="threshold-percentage"
              min="1"
              max="100"
              value={getThresholdPercentage()}
              onChange={handlePercentageChange}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={disabled}
            />
            <div className="flex justify-between mt-2 text-xs text-zinc-500">
              <span>1%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
          
          <div className="p-3 bg-zinc-900 rounded border-l-4 border-blue-500">
            <p className="text-sm text-zinc-400">
              Example: With {getThresholdPercentage()}% threshold and 10 members, 
              at least {Math.ceil(10 * thresholdValue)} members must approve.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default RuleSelector;
