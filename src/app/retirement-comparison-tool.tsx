"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

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
    trsPercentagePerYear: 0.023,
    trsTopSalaryYears: 5,
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
            orpEmployeeContribution, orpEmployerContribution, orpWithdrawalAmount,
            trsPercentagePerYear, trsTopSalaryYears } = inputs;
    
    const totalYears = lifeExpectancy - currentAge;
    const workingYears = retirementAge - currentAge;
    
    let trsCashFlows = new Array(totalYears).fill(0);
    let orpCashFlows = new Array(totalYears).fill(0);
    let orpBalances = new Array(totalYears).fill(0);
    let orpBalance = 0;
    
    // Calculate final average salary for TRS
    const salaries = [];
    for (let year = 0; year < workingYears; year++) {
      salaries.push(currentSalary * Math.pow(1 + salaryGrowthRate, year));
    }
    const topSalaries = salaries.slice(-trsTopSalaryYears);
    const finalAverageSalary = topSalaries.reduce((sum, salary) => sum + salary, 0) / trsTopSalaryYears;
    
    // Calculate TRS annuity
    const yearsOfService = workingYears;
    const annuityPercentage = yearsOfService * trsPercentagePerYear;
    const trsAnnuity = finalAverageSalary * annuityPercentage;
    
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

  const renderInputSection = (title: string, inputs: any[]) => (
    <Collapsible className="mb-6">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 p-4">
          {inputs.map(({ name, label, step, explanation, min }) => 
            renderInput(name, label, step, explanation, min)
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  return (
    <div className="p-4 w-full mx-auto">
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
          
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="w-full lg:w-1/2">
              <h2 className="text-2xl font-bold mb-4">Inputs</h2>
              {renderInputSection("Personal Information", [
                { name: "currentAge", label: "Current Age", step: 1, explanation: "Your current age in years." },
                { name: "retirementAge", label: "Retirement Age", step: 1, explanation: "The age at which you plan to retire.", min: inputs.currentAge },
                { name: "lifeExpectancy", label: "Life Expectancy", step: 1, explanation: "The age to which you expect to live.", min: inputs.retirementAge },
              ])}

              {renderInputSection("Salary Information", [
                { name: "currentSalary", label: "Current Salary", step: 1000, explanation: "Your current annual salary." },
                { name: "salaryGrowthRate", label: "Salary Growth Rate", step: 0.001, explanation: "Expected annual increase in your salary, e.g., 0.03 for 3%." },
              ])}

              {renderInputSection("Financial Assumptions", [
                { name: "discountRate", label: "Discount Rate", step: 0.001, explanation: "Rate used to calculate present value of future cash flows." },
                { name: "orpReturnRate", label: "ORP Return Rate", step: 0.001, explanation: "Expected annual return on ORP investments." },
              ])}

              {renderInputSection("TRS Information", [
                { name: "trsEmployeeContribution", label: "TRS Employee Contribution", step: 0.001, explanation: "Percentage of salary you contribute to TRS, e.g., 0.0825 for 8.25%." },
                { name: "trsPercentagePerYear", label: "TRS Percentage Per Year", step: 0.001, explanation: "Percentage of salary per year of service for TRS calculation, e.g., 0.023 for 2.3%." },
                { name: "trsTopSalaryYears", label: "TRS Top Salary Years", step: 1, explanation: "Number of highest-paid years used to calculate TRS benefit.", min: 1 },
              ])}

              {renderInputSection("ORP Information", [
                { name: "orpEmployeeContribution", label: "ORP Employee Contribution", step: 0.001, explanation: "Percentage of salary you contribute to ORP, e.g., 0.0665 for 6.65%." },
                { name: "orpEmployerContribution", label: "ORP Employer Contribution", step: 0.001, explanation: "Percentage of salary your employer contributes to ORP." },
                { name: "orpWithdrawalAmount", label: "ORP Annual Withdrawal Amount", step: 1000, explanation: "Fixed amount to withdraw annually from ORP during retirement. Default is the optimal amount to deplete the account at life expectancy." },
              ])}
            </div>

            <div className="w-full lg:w-1/2">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-4">Results</h2>
                <table className="w-full border-collapse">
                  <tbody>
                    <tr>
                      <td className="border px-4 py-2">Average Lifetime Salary</td>
                      <td className="border px-4 py-2">${results.averageLifetimeSalary.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="border px-4 py-2">Optimal ORP Withdrawal (to deplete at life expectancy)</td>
                      <td className="border px-4 py-2">${results.optimalOrpWithdrawal.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="border px-4 py-2">TRS NPV</td>
                      <td className="border px-4 py-2">${results.trsNpv.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="border px-4 py-2">ORP NPV</td>
                      <td className="border px-4 py-2">${results.orpNpv.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="border px-4 py-2">Final ORP Balance</td>
                      <td className="border px-4 py-2">${results.finalOrpBalance.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan="2" className="border px-4 py-2 font-bold">
                        {results.trsNpv > results.orpNpv
                          ? `TRS is favorable by $${(results.trsNpv - results.orpNpv).toFixed(2)}`
                          : `ORP is favorable by $${(results.orpNpv - results.trsNpv).toFixed(2)}`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Cash Flow Comparison</h3>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="h-80 mt-2">
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
                </CollapsibleContent>
              </Collapsible>

              <Collapsible className="mt-6">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full flex justify-between items-center">
                    <h3 className="text-lg font-semibold">ORP Balance Over Time</h3>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="h-80 mt-2">
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
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RetirementComparisonTool;
