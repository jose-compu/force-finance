const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockSAVAX", function () {
    let mockSAVAX;
    let owner, user1, user2;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        
        const MockSAVAX = await ethers.getContractFactory("MockSAVAX");
        mockSAVAX = await MockSAVAX.deploy();
    });

    describe("Deployment", function () {
        it("Should set correct initial parameters", async function () {
            expect(await mockSAVAX.name()).to.equal("Staked AVAX");
            expect(await mockSAVAX.symbol()).to.equal("sAVAX");
            expect(await mockSAVAX.decimals()).to.equal(18);
            expect((await mockSAVAX.getExchangeRate()).toString()).to.equal(ethers.utils.parseEther("1").toString());
        });
    });

    describe("ISAVAXToken Interface Implementation", function () {
        it("Should implement getPooledAvaxByShares correctly", async function () {
            const shares = ethers.utils.parseEther("100");
            const avaxAmount = await mockSAVAX.getPooledAvaxByShares(shares);
            expect(avaxAmount.toString()).to.equal(ethers.utils.parseEther("100").toString()); // 1:1 ratio initially
        });

        it("Should implement getSharesByPooledAvax correctly", async function () {
            const avaxAmount = ethers.utils.parseEther("50");
            const shares = await mockSAVAX.getSharesByPooledAvax(avaxAmount);
            expect(shares.toString()).to.equal(ethers.utils.parseEther("50").toString()); // 1:1 ratio initially
        });

        it("Should implement getTotalPooledAvax correctly", async function () {
            // Mint some tokens first
            await mockSAVAX.mint(user1.address, ethers.utils.parseEther("100"));
            
            const totalPooledAvax = await mockSAVAX.getTotalPooledAvax();
            expect(totalPooledAvax.toString()).to.equal(ethers.utils.parseEther("100").toString());
        });

        it("Should implement getTotalShares correctly", async function () {
            await mockSAVAX.mint(user1.address, ethers.utils.parseEther("100"));
            
            const totalShares = await mockSAVAX.getTotalShares();
            expect(totalShares.toString()).to.equal(ethers.utils.parseEther("100").toString());
        });

        it("Should implement submit() function", async function () {
            const avaxAmount = ethers.utils.parseEther("10");
            
            const tx = await mockSAVAX.connect(user1).submit({ value: avaxAmount });
            const receipt = await tx.wait();
            
            expect((await mockSAVAX.balanceOf(user1.address)).toString()).to.equal(avaxAmount.toString());
        });

        it("Should implement requestWithdrawal() function", async function () {
            // First mint some tokens
            await mockSAVAX.mint(user1.address, ethers.utils.parseEther("100"));
            
            const withdrawalAmount = ethers.utils.parseEther("50");
            const tx = await mockSAVAX.connect(user1).requestWithdrawal(withdrawalAmount);
            const receipt = await tx.wait();
            
            // Check that tokens were burned
            expect((await mockSAVAX.balanceOf(user1.address)).toString()).to.equal(ethers.utils.parseEther("50").toString());
            
            // Check withdrawal request was created
            const requests = await mockSAVAX.getWithdrawalRequests(user1.address);
            expect(requests.length).to.equal(1);
            expect(requests[0].amount.toString()).to.equal(ethers.utils.parseEther("50").toString());
            expect(requests[0].claimed).to.equal(false);
        });

        it("Should implement claimWithdrawal() function", async function () {
            // Setup withdrawal request
            await mockSAVAX.mint(user1.address, ethers.utils.parseEther("100"));
            await mockSAVAX.connect(user1).requestWithdrawal(ethers.utils.parseEther("50"));
            
            const tx = await mockSAVAX.connect(user1).claimWithdrawal(user2.address);
            const receipt = await tx.wait();
            
            // Check that withdrawal was marked as claimed
            const requests = await mockSAVAX.getWithdrawalRequests(user1.address);
            expect(requests[0].claimed).to.equal(true);
        });

        it("Should implement getExchangeRate() function", async function () {
            const rate = await mockSAVAX.getExchangeRate();
            expect(rate.toString()).to.equal(ethers.utils.parseEther("1").toString());
        });
    });

    describe("Exchange Rate Functionality", function () {
        it("Should update exchange rate correctly", async function () {
            const newRate = ethers.utils.parseEther("1.05"); // 5% increase
            await mockSAVAX.setExchangeRate(newRate);
            
            expect((await mockSAVAX.getExchangeRate()).toString()).to.equal(newRate.toString());
        });

        it("Should simulate yield correctly", async function () {
            const initialRate = await mockSAVAX.getExchangeRate();
            await mockSAVAX.simulateYield(500); // 5% yield
            
            const newRate = await mockSAVAX.getExchangeRate();
            expect(newRate.gt(initialRate)).to.be.true;
        });

        it("Should calculate pooled AVAX correctly with different exchange rates", async function () {
            // Set exchange rate to 1.05 (5% yield)
            await mockSAVAX.setExchangeRate(ethers.utils.parseEther("1.05"));
            
            const shares = ethers.utils.parseEther("100");
            const avaxAmount = await mockSAVAX.getPooledAvaxByShares(shares);
            expect(avaxAmount.toString()).to.equal(ethers.utils.parseEther("105").toString()); // 100 * 1.05
        });
    });

    describe("Staking Rewards System", function () {
        it("Should track rewards correctly", async function () {
            // Mint tokens to user
            await mockSAVAX.mint(user1.address, ethers.utils.parseEther("100"));
            
            // Advance blocks to generate rewards
            await ethers.provider.send("evm_mine", []);
            await ethers.provider.send("evm_mine", []);
            
            const claimableRewards = await mockSAVAX.getClaimableRewards(user1.address);
            expect(claimableRewards.gt(0)).to.be.true;
        });

        it("Should claim rewards correctly", async function () {
            await mockSAVAX.mint(user1.address, ethers.utils.parseEther("100"));
            
            // Advance blocks
            await ethers.provider.send("evm_mine", []);
            await ethers.provider.send("evm_mine", []);
            
            const claimedAmount = await mockSAVAX.claimRewards(user1.address);
            expect(claimedAmount.toString()).to.not.equal("0");
            
            // Check that rewards were reset
            const remainingRewards = await mockSAVAX.getClaimableRewards(user1.address);
            expect(remainingRewards.toString()).to.equal("0");
        });

        it("Should update reward rate correctly", async function () {
            const newRate = ethers.utils.parseEther("0.02"); // 2% per block
            await mockSAVAX.setRewardRate(newRate);
            
            // Mint tokens and advance blocks
            await mockSAVAX.mint(user1.address, ethers.utils.parseEther("100"));
            await ethers.provider.send("evm_mine", []);
            
            const claimableRewards = await mockSAVAX.getClaimableRewards(user1.address);
            expect(claimableRewards.gt(0)).to.be.true;
        });
    });

    describe("Withdrawal System", function () {
        it("Should track multiple withdrawal requests", async function () {
            await mockSAVAX.mint(user1.address, ethers.utils.parseEther("100"));
            
            // Create multiple withdrawal requests
            await mockSAVAX.connect(user1).requestWithdrawal(ethers.utils.parseEther("30"));
            await mockSAVAX.connect(user1).requestWithdrawal(ethers.utils.parseEther("20"));
            
            const requests = await mockSAVAX.getWithdrawalRequests(user1.address);
            expect(requests.length).to.equal(2);
            
            const totalPending = await mockSAVAX.getTotalPendingWithdrawals(user1.address);
            expect(totalPending.toString()).to.equal(ethers.utils.parseEther("50").toString());
        });

        it("Should handle partial withdrawal claims", async function () {
            await mockSAVAX.mint(user1.address, ethers.utils.parseEther("100"));
            await mockSAVAX.connect(user1).requestWithdrawal(ethers.utils.parseEther("50"));
            
            // Claim withdrawal
            await mockSAVAX.connect(user1).claimWithdrawal(user2.address);
            
            const totalPending = await mockSAVAX.getTotalPendingWithdrawals(user1.address);
            expect(totalPending.toString()).to.equal("0");
        });
    });

    describe("Access Control", function () {
        it("Should only allow authorized roles to mint", async function () {
            try {
                await mockSAVAX.connect(user1).mint(user2.address, ethers.utils.parseEther("100"));
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("AccessControl");
            }
        });

        it("Should only allow authorized roles to burn", async function () {
            await mockSAVAX.mint(user1.address, ethers.utils.parseEther("100"));
            
            try {
                await mockSAVAX.connect(user1).burn(user1.address, ethers.utils.parseEther("50"));
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("AccessControl");
            }
        });

        it("Should only allow authorized roles to simulate yield", async function () {
            try {
                await mockSAVAX.connect(user1).simulateYield(100);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("AccessControl");
            }
        });

        it("Should only allow authorized roles to claim rewards", async function () {
            try {
                await mockSAVAX.connect(user1).claimRewards(user1.address);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("AccessControl");
            }
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero amount submissions", async function () {
            try {
                await mockSAVAX.connect(user1).submit({ value: 0 });
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Must submit AVAX");
            }
        });

        it("Should handle insufficient balance for withdrawal", async function () {
            try {
                await mockSAVAX.connect(user1).requestWithdrawal(ethers.utils.parseEther("100"));
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Insufficient sAVAX balance");
            }
        });

        it("Should handle zero amount withdrawals", async function () {
            try {
                await mockSAVAX.connect(user1).requestWithdrawal(0);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Amount must be greater than 0");
            }
        });

        it("Should handle invalid recipient for withdrawal claim", async function () {
            try {
                await mockSAVAX.connect(user1).claimWithdrawal(ethers.constants.AddressZero);
                expect.fail("Expected transaction to revert");
            } catch (error) {
                expect(error.message).to.include("Invalid recipient");
            }
        });
    });
});
