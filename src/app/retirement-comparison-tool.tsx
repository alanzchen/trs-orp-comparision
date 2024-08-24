"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const RetirementComparisonTool = () => {
  const [inputs, setInputs] = useState({
    currentAge: 30,
    retirementAge: 65,
    currentSalary: 50000,
    salaryGrowthRate: 0.03,
    discountRate: 0.05,
    orpReturnRate: 0.07,
    lifeExpectancy: 85,
    trsEmployeeContribution: 0.0825,
    orpEmployeeContribution: 0.0665,
    orpEmployerContribution: 0.085,
    orpWithdrawalAmount: 0, // This will be calculated and set in useEffect
  });

  const [results, setResults] = useState({
    trsNpv: 0,
    orpNpv: 0,
    cashFlows: [],
    orpBalances: [],
    finalOrpBalance: 0,
    averageLifetimeSalary: 0,
    optimalOrpWithdrawal: 0,
  });

  const [invalidAge, setInvalidAge] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: parseFloat(value) }));
  };

  const calculateAverageLifetimeSalary = () => {
    const { currentAge, retirementAge, currentSalary, salaryGrowthRate } = inputs;
    const workingYears = retirementAge - currentAge;
    let totalSalary = 0;
    for (let year = 0; year < workingYears; year++) {
      totalSalary += currentSalary * Math.pow(1 + salaryGrowthRate, year);
    }
    return totalSalary / workingYears;
  };

  const calculateOptimalOrpWithdrawal = () => {
    const { currentAge, retirementAge, lifeExpectancy, currentSalary, salaryGrowthRate, 
            orpReturnRate, orpEmployeeContribution, orpEmployerContribution } = inputs;
    
    const workingYears = retirementAge - currentAge;
    const retirementYears = lifeExpectancy - retirementAge;

    // Calculate initial ORP balance at retirement
    let orpBalance = 0;
    for (let year = 0; year < workingYears; year++) {
      const salary = currentSalary * Math.pow(1 + salaryGrowthRate, year);
      orpBalance = (orpBalance + salary * (orpEmployeeContribution + orpEmployerContribution)) * (1 + orpReturnRate);
    }

    // Binary search to find optimal withdrawal amount
    let low = 0;
    let high = orpBalance; // Start with the entire balance as upper bound
    let optimalWithdrawal = 0;
    const epsilon = 0.01; // Precision of the result

    while (high - low > epsilon) {
      const mid = (low + high) / 2;
      let testBalance = orpBalance;

      for (let year = 0; year < retirementYears; year++) {
        testBalance = (testBalance - mid) * (1 + orpReturnRate);
      }

      if (testBalance > 0) {
        low = mid;
        optimalWithdrawal = mid;
      } else {
        high = mid;
      }
    }

    return optimalWithdrawal;
  };

  useEffect(() => {
    const averageLifetimeSalary = calculateAverageLifetimeSalary();
    const optimalOrpWithdrawal = calculateOptimalOrpWithdrawal();
    setInputs(prev => ({ ...prev, orpWithdrawalAmount: optimalOrpWithdrawal }));
    setResults(prev => ({ ...prev, averageLifetimeSalary, optimalOrpWithdrawal }));
  }, [inputs.currentAge, inputs.retirementAge, inputs.currentSalary, inputs.salaryGrowthRate, 
      inputs.orpReturnRate, inputs.orpEmployeeContribution, inputs.orpEmployerContribution, inputs.lifeExpectancy]);

  const calculateCashFlows = () => {
    const { currentAge, retirementAge, lifeExpectancy, currentSalary, salaryGrowthRate, 
            orpReturnRate, trsEmployeeContribution,
            orpEmployeeContribution, orpEmployerContribution, orpWithdrawalAmount } = inputs;
    
    const totalYears = lifeExpectancy - currentAge;
    const workingYears = retirementAge - currentAge;
    
    let trsCashFlows = new Array(totalYears).fill(0);
    let orpCashFlows = new Array(totalYears).fill(0);
    let orpBalances = new Array(totalYears).fill(0);
    let orpBalance = 0;
    
    // Calculate final salary for TRS
    const finalSalary = currentSalary * Math.pow(1 + salaryGrowthRate, workingYears - 1);
    
    // Calculate TRS annuity
    const yearsOfService = workingYears;
    const annuityPercentage = yearsOfService * 0.023; // 2.3% per year
    const trsAnnuity = finalSalary * annuityPercentage;
    
    for (let year = 0; year < totalYears; year++) {
      const age = currentAge + year;
      const salary = currentSalary * Math.pow(1 + salaryGrowthRate, year);
      
      if (age < retirementAge) {
        // Working years
        trsCashFlows[year] = salary * (1 - trsEmployeeContribution);
        orpCashFlows[year] = salary * (1 - orpEmployeeContribution);
        orpBalance = (orpBalance + salary * (orpEmployeeContribution + orpEmployerContribution)) * (1 + orpReturnRate);
      } else {
        // Retirement years
        trsCashFlows[year] = trsAnnuity;
        
        if (year < totalYears - 1) {
          // Regular retirement years
          const orpWithdrawal = Math.min(orpWithdrawalAmount, orpBalance);
          orpCashFlows[year] = orpWithdrawal;
          orpBalance = (orpBalance - orpWithdrawal) * (1 + orpReturnRate);
        } else {
          // Final year: withdraw entire ORP balance
          orpCashFlows[year] = orpBalance;
          orpBalance = 0;
        }
      }
      orpBalances[year] = orpBalance;
    }
    
    // Calculate NPV
    const npv = (cashFlows) => {
      return cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + inputs.discountRate, t), 0);
    };
    
    const trsNpv = npv(trsCashFlows);
    const orpNpv = npv(orpCashFlows);
    
    // Prepare data for charts
    const cashFlowData = trsCashFlows.map((trsCf, index) => ({
      age: currentAge + index,
      TRS: trsCf,
      ORP: orpCashFlows[index],
    }));
    
    const orpBalanceData = orpBalances.map((balance, index) => ({
      age: currentAge + index,
      'ORP Balance': balance,
    }));
    
    setResults(prev => ({ 
      ...prev,
      trsNpv, 
      orpNpv, 
      cashFlows: cashFlowData, 
      orpBalances: orpBalanceData, 
      finalOrpBalance: orpCashFlows[totalYears - 1] 
    }));
  };

  useEffect(() => {
    // don't calculate if retirement age is less than current age, or if life expectancy is less than retirement age
    if (inputs.retirementAge < inputs.currentAge || inputs.lifeExpectancy < inputs.retirementAge) {
      setInvalidAge(true);
      return;
    } else {
      setInvalidAge(false);
    }
    calculateCashFlows();
  }, [inputs]);

  const renderInput = (name, label, step = 1, explanation, min = 0) => (
    <div className="mb-4">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        step={step}
        value={inputs[name]}
        onChange={handleInputChange}
        min={min}
      />
      <p className="text-sm text-gray-600 mt-1">{explanation}</p>
    </div>
  );

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Retirement Plan Comparison Tool</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <p className="text-red-500 text-sm">
              {invalidAge && "Retirement age must be greater than current age, and life expectancy must be greater than retirement age."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {renderInput("currentAge", "Current Age", 1, "Your current age in years.")}
            {renderInput("retirementAge", "Retirement Age", 1, "The age at which you plan to retire.", inputs.currentAge)}
            {renderInput("currentSalary", "Current Salary", 1000, "Your current annual salary.")}
            {renderInput("salaryGrowthRate", "Salary Growth Rate", 0.001, "Expected annual increase in your salary, e.g., 0.03 for 3%.")}
            {renderInput("discountRate", "Discount Rate", 0.001, "Rate used to calculate present value of future cash flows.")}
            {renderInput("orpReturnRate", "ORP Return Rate", 0.001, "Expected annual return on ORP investments.")}
            {renderInput("lifeExpectancy", "Life Expectancy", 1, "The age to which you expect to live.", inputs.retirementAge)}
            {renderInput("trsEmployeeContribution", "TRS Employee Contribution", 0.001, "Percentage of salary you contribute to TRS, e.g., 0.0825 for 8.25%.")}
            {renderInput("orpEmployeeContribution", "ORP Employee Contribution", 0.001, "Percentage of salary you contribute to ORP, e.g., 0.0665 for 6.65%.")}
            {renderInput("orpEmployerContribution", "ORP Employer Contribution", 0.001, "Percentage of salary your employer contributes to ORP.")}
            {renderInput("orpWithdrawalAmount", "ORP Annual Withdrawal Amount", 1000, "Fixed amount to withdraw annually from ORP during retirement. Default is the optimal amount to deplete the account at life expectancy.")}
          </div>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Results:</h3>
            <p>Average Lifetime Salary: ${results.averageLifetimeSalary.toFixed(2)}</p>
            <p>Optimal ORP Withdrawal (to deplete at life expectancy): ${results.optimalOrpWithdrawal.toFixed(2)}</p>
            <p>TRS NPV: ${results.trsNpv.toFixed(2)}</p>
            <p>ORP NPV: ${results.orpNpv.toFixed(2)}</p>
            <p>Final ORP Balance: ${results.finalOrpBalance.toFixed(2)}</p>
            <p className="font-bold mt-2">
              {results.trsNpv > results.orpNpv
                ? `TRS is favorable by $${(results.trsNpv - results.orpNpv).toFixed(2)}`
                : `ORP is favorable by $${(results.orpNpv - results.trsNpv).toFixed(2)}`}
            </p>
          </div>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Cash Flow Comparison:</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={results.cashFlows}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="age" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="TRS" stroke="#8884d8" activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="ORP" stroke="#82ca9d" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">ORP Balance Over Time:</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={results.orpBalances}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="age" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="ORP Balance" stroke="#82ca9d" activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RetirementComparisonTool;
